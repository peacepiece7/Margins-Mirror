import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const frontRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.join(frontRoot, 'src');
const fixtureRoot = path.join(frontRoot, 'scripts', 'fixtures', 'form-ownership');
const fixtureMode = process.argv.includes('--fixtures');

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
}

async function sourceFiles(root) {
  if (!(await exists(root))) return [];
  const files = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const target = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await sourceFiles(target)));
    else if (/\.tsx?$/.test(entry.name) && !entry.name.endsWith('.test.tsx')) files.push(target);
  }
  return files;
}

function callName(node) {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression)
    ? node.expression.text
    : undefined;
}

function propertyName(node) {
  return node && (ts.isIdentifier(node) || ts.isStringLiteral(node)) ? node.text : undefined;
}

function stringArgument(node, index = 0) {
  const argument = ts.isCallExpression(node) ? node.arguments[index] : undefined;
  return argument && ts.isStringLiteral(argument) ? argument.text : undefined;
}

function objectLiteralProperty(object, name) {
  return object.properties.find(
    (property) => ts.isPropertyAssignment(property) && propertyName(property.name) === name,
  )?.initializer;
}

function declarationsByName(tree) {
  const declarations = new Map();
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      declarations.set(node.name.text, node.initializer);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  return declarations;
}

function resolveObjectLiteral(node, declarations, seen = new Set()) {
  if (ts.isObjectLiteralExpression(node)) return node;
  if (!ts.isIdentifier(node) || seen.has(node.text)) return undefined;
  seen.add(node.text);
  const initializer = declarations.get(node.text);
  return initializer ? resolveObjectLiteral(initializer, declarations, seen) : undefined;
}

function objectKeys(object) {
  return object.properties.flatMap((property) => {
    if (ts.isSpreadAssignment(property)) return [];
    const name = propertyName(property.name);
    return name ? [name] : [];
  });
}

function stateBindingNames(node) {
  if (!ts.isVariableDeclaration(node) || !ts.isArrayBindingPattern(node.name)) return [];
  return node.name.elements.flatMap((element) =>
    ts.isBindingElement(element) && ts.isIdentifier(element.name) ? [element.name.text] : [],
  );
}

function expressionText(node, tree) {
  return node ? node.getText(tree) : '';
}

function jsxAttribute(node, name) {
  return node.attributes.properties.find(
    (attribute) => ts.isJsxAttribute(attribute) && propertyName(attribute.name) === name,
  );
}

function jsxAttributeExpression(attribute) {
  return attribute &&
    ts.isJsxAttribute(attribute) &&
    attribute.initializer &&
    ts.isJsxExpression(attribute.initializer)
    ? attribute.initializer.expression
    : undefined;
}

function jsxAttributeValue(attribute) {
  if (!attribute || !ts.isJsxAttribute(attribute) || !attribute.initializer) return undefined;
  if (ts.isStringLiteral(attribute.initializer)) return attribute.initializer;
  return ts.isJsxExpression(attribute.initializer) ? attribute.initializer.expression : undefined;
}

function isHandleSubmitCall(node) {
  if (!ts.isCallExpression(node)) return false;
  return (
    (ts.isIdentifier(node.expression) && node.expression.text === 'handleSubmit') ||
    (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'handleSubmit')
  );
}

function isFormHookCall(node) {
  const name = callName(node);
  return name === 'useForm' || name === 'useFormContext';
}

function bindingNames(node) {
  if (!ts.isObjectBindingPattern(node)) return [];
  return node.elements.flatMap((element) => {
    if (!ts.isBindingElement(element) || !element.name || !ts.isIdentifier(element.name)) {
      return [];
    }
    const property = element.property || element.name;
    return ts.isIdentifier(property) || ts.isStringLiteral(property)
      ? [{ property: property.text, local: element.name.text }]
      : [];
  });
}

function collectHandleSubmitInfo(node, aliases, aliasOwners, handleSubmitOwners, seen = new Set()) {
  const info = { found: false, owners: new Set() };
  if (!node || seen.has(node)) return info;
  seen.add(node);
  if (isHandleSubmitCall(node)) {
    info.found = true;
    const owner = handleSubmitCallOwner(node, handleSubmitOwners);
    if (owner) info.owners.add(owner);
  }
  if (ts.isIdentifier(node) && aliases.has(node.text)) {
    info.found = true;
    const owner = aliasOwners.get(node.text);
    if (owner) info.owners.add(owner);
  }
  ts.forEachChild(node, (child) => {
    const childInfo = collectHandleSubmitInfo(
      child,
      aliases,
      aliasOwners,
      handleSubmitOwners,
      seen,
    );
    info.found ||= childInfo.found;
    childInfo.owners.forEach((owner) => info.owners.add(owner));
  });
  return info;
}

function handleSubmitCallOwner(node, handleSubmitOwners) {
  if (!isHandleSubmitCall(node)) return undefined;
  if (ts.isIdentifier(node.expression)) return handleSubmitOwners.get(node.expression.text);
  if (
    ts.isPropertyAccessExpression(node.expression) &&
    ts.isIdentifier(node.expression.expression)
  ) {
    return handleSubmitOwners.get(node.expression.expression.text);
  }
  return undefined;
}

function usesFormField(expression, formFields, tree) {
  const text = expressionText(expression, tree);
  return [...formFields].some(
    (field) =>
      new RegExp(`(?:^|\\W)${field}(?:$|\\W)`).test(text) ||
      new RegExp(`set${field[0]?.toUpperCase()}${field.slice(1)}(?:$|\\W)`).test(text),
  );
}

function lineViolation(file, tree, node, message) {
  const position = tree.getLineAndCharacterOfPosition(node.getStart(tree));
  return `${path.relative(frontRoot, file)}:${position.line + 1} ${message}`;
}

function auditSource(file, source) {
  const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = declarationsByName(tree);
  const formFields = new Set();
  const formFieldsByOwner = new Map();
  const formBindings = new Map();
  const controlBindings = new Map();
  const registerBindings = new Map();
  const handleSubmitBindings = new Map();
  const formHookOwners = new Map();
  const registerCallOwners = new Map();
  const useStateDeclarations = [];
  const storeBindings = [];
  const urlMirrors = [];
  const valueTunnels = [];
  const formElements = [];
  const handleSubmitAliases = new Set();
  const handleSubmitAliasOwners = new Map();
  const controlledFieldOwners = new Map();
  const controlledBindingOwners = new Map();
  let usesForm = false;

  function addField(owner, field) {
    if (!field) return;
    formFields.add(field);
    if (!owner) return;
    const fields = formFieldsByOwner.get(owner) ?? new Set();
    fields.add(field);
    formFieldsByOwner.set(owner, fields);
  }

  function collectFormBindings(node) {
    if (!ts.isVariableDeclaration(node) || !node.initializer || !isFormHookCall(node.initializer)) {
      return;
    }
    const owner = ts.isIdentifier(node.name)
      ? node.name.text
      : `form-context:${node.getStart(tree)}`;
    formHookOwners.set(node.initializer, owner);
    if (ts.isIdentifier(node.name)) {
      formBindings.set(node.name.text, owner);
      handleSubmitBindings.set(node.name.text, owner);
    }
    for (const binding of bindingNames(node.name)) {
      if (binding.property === 'register') registerBindings.set(binding.local, owner);
      if (binding.property === 'handleSubmit') handleSubmitBindings.set(binding.local, owner);
      if (binding.property === 'control') controlBindings.set(binding.local, owner);
    }
  }

  function controlOwner(expression) {
    if (!expression) return undefined;
    if (ts.isIdentifier(expression)) return controlBindings.get(expression.text);
    if (ts.isPropertyAccessExpression(expression) && expression.name.text === 'control') {
      if (ts.isIdentifier(expression.expression)) {
        return formBindings.get(expression.expression.text);
      }
      if (ts.isCallExpression(expression.expression)) {
        return formHookOwners.get(expression.expression);
      }
    }
    if (ts.isCallExpression(expression)) return formHookOwners.get(expression);
    return undefined;
  }

  function precollect(node) {
    collectFormBindings(node);
    ts.forEachChild(node, precollect);
  }
  precollect(tree);

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const name = callName(node);
      if (name === 'useForm' || name === 'useFormContext') usesForm = true;
      if (name === 'handleSubmit') handleSubmitAliases.add(name);

      if (name === 'useForm') {
        const options = node.arguments[0];
        const optionsObject = options && resolveObjectLiteral(options, declarations);
        const defaultsNode = optionsObject && objectLiteralProperty(optionsObject, 'defaultValues');
        const defaults = defaultsNode && resolveObjectLiteral(defaultsNode, declarations);
        if (defaults) {
          objectKeys(defaults).forEach((field) => addField(formHookOwners.get(node), field));
        }
      }

      if (
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'register'
      ) {
        const field = stringArgument(node);
        if (field) {
          usesForm = true;
          const owner =
            ts.isIdentifier(node.expression.expression) &&
            formBindings.get(node.expression.expression.text);
          registerCallOwners.set(node, owner);
          addField(owner, field);
        }
      }

      if (name === 'register') {
        const field = stringArgument(node);
        if (field) {
          usesForm = true;
          const owner = registerBindings.get(node.expression.text);
          registerCallOwners.set(node, owner);
          addField(owner, field);
        }
      }

      if (name === 'useController') {
        const options = node.arguments[0];
        if (options && ts.isObjectLiteralExpression(options)) {
          const field = objectLiteralProperty(options, 'name');
          if (field && ts.isStringLiteral(field)) {
            const owner = controlOwner(objectLiteralProperty(options, 'control'));
            addField(owner, field.text);
            controlledFieldOwners.set(node, owner);
          }
        }
      }

      if (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'set') {
        const key = stringArgument(node);
        if (key) urlMirrors.push({ key, node });
      }
    }

    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      callName(node.initializer) === 'useState'
    ) {
      useStateDeclarations.push({ names: stateBindingNames(node), node });
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      isHandleSubmitCall(node.initializer)
    ) {
      handleSubmitAliases.add(node.name.text);
      handleSubmitAliasOwners.set(
        node.name.text,
        handleSubmitCallOwner(node.initializer, handleSubmitBindings),
      );
    }

    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ts.isIdentifier(node.initializer.expression) &&
      /^use[A-Z].*Store$/.test(node.initializer.expression.text)
    ) {
      storeBindings.push({ node, text: node.getText(tree) });
    }

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      callName(node.initializer) === 'useController'
    ) {
      const options = node.initializer.arguments[0];
      if (options && ts.isObjectLiteralExpression(options)) {
        controlledBindingOwners.set(
          node.name.text,
          controlOwner(objectLiteralProperty(options, 'control')),
        );
      }
    }

    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tagName = node.tagName.getText(tree);
      if (tagName === 'form') {
        formElements.push({
          node:
            ts.isJsxElement(node.parent) && node.parent.openingElement === node
              ? node.parent
              : node,
          onSubmit: jsxAttributeExpression(jsxAttribute(node, 'onSubmit')),
        });
      }
      if (tagName === 'Controller') {
        const name = jsxAttributeValue(jsxAttribute(node, 'name'));
        if (name && ts.isStringLiteral(name)) {
          const owner = controlOwner(jsxAttributeExpression(jsxAttribute(node, 'control')));
          addField(owner, name.text);
          controlledFieldOwners.set(node, owner);
        }
      }

      if (/^[A-Z]/.test(tagName)) {
        const value = jsxAttributeExpression(jsxAttribute(node, 'value'));
        const onChange = jsxAttributeExpression(jsxAttribute(node, 'onChange'));
        const controllerField =
          expressionText(value, tree).includes('field.value') &&
          expressionText(onChange, tree).includes('field.onChange');
        if (value && onChange && !controllerField) valueTunnels.push({ node, value, onChange });
      }
    }

    ts.forEachChild(node, visit);
  }
  visit(tree);

  if (!usesForm && formFields.size === 0) return [];

  const violations = [];
  for (const form of formElements) {
    const submitInfo = collectHandleSubmitInfo(
      form.onSubmit,
      handleSubmitAliases,
      handleSubmitAliasOwners,
      handleSubmitBindings,
    );
    const fieldOwners = new Set();
    function collectFormFields(node) {
      if (ts.isCallExpression(node) && registerCallOwners.has(node)) {
        const owner = registerCallOwners.get(node);
        if (owner) fieldOwners.add(owner);
      }
      if (controlledFieldOwners.has(node)) {
        const owner = controlledFieldOwners.get(node);
        if (owner) fieldOwners.add(owner);
      }
      if (ts.isIdentifier(node) && controlledBindingOwners.has(node.text)) {
        const owner = controlledBindingOwners.get(node.text);
        if (owner) fieldOwners.add(owner);
      }
      ts.forEachChild(node, collectFormFields);
    }
    collectFormFields(form.node);
    const hasOwnerMismatch =
      fieldOwners.size > 0 &&
      submitInfo.owners.size > 0 &&
      [...fieldOwners].every((owner) => !submitInfo.owners.has(owner));
    if (!submitInfo.found || hasOwnerMismatch) {
      violations.push(
        lineViolation(
          file,
          tree,
          form.node,
          hasOwnerMismatch
            ? 'RHF-owned forms must submit through their matching handleSubmit'
            : 'RHF-owned forms must submit through handleSubmit',
        ),
      );
    }
  }
  const reservedFormState = /^(?:errors?|formErrors?|submitting|isSubmitting|dirty|isDirty)$/i;
  for (const declaration of useStateDeclarations) {
    for (const name of declaration.names) {
      if (formFields.has(name) || reservedFormState.test(name)) {
        violations.push(
          lineViolation(
            file,
            tree,
            declaration.node,
            `"${name}" duplicates React Hook Form ownership`,
          ),
        );
      }
    }
  }

  for (const binding of storeBindings) {
    if (
      [...formFields].some((field) => new RegExp(`(?:^|\\W)${field}(?:$|\\W)`).test(binding.text))
    ) {
      violations.push(
        lineViolation(file, tree, binding.node, 'Zustand mirrors a React Hook Form field'),
      );
    }
  }

  for (const mirror of urlMirrors) {
    if (formFields.has(mirror.key)) {
      violations.push(
        lineViolation(file, tree, mirror.node, `"${mirror.key}" mirrors form state into URL state`),
      );
    }
  }

  for (const tunnel of valueTunnels) {
    if (
      usesFormField(tunnel.value, formFields, tree) ||
      usesFormField(tunnel.onChange, formFields, tree)
    ) {
      violations.push(
        lineViolation(file, tree, tunnel.node, 'value/onChange props tunnel React Hook Form state'),
      );
    }
  }

  return violations;
}

const files = await sourceFiles(fixtureMode ? fixtureRoot : sourceRoot);
const violations = (
  await Promise.all(files.map(async (file) => auditSource(file, await readFile(file, 'utf8'))))
).flat();

if (fixtureMode) {
  const expected = new Map([
    ['approved-workflow-props.tsx', 0],
    ['cross-file-field.tsx', 1],
    ['destructured-register.tsx', 1],
    ['wrong-controller-owner.tsx', 1],
    ['wrong-use-controller-owner.tsx', 1],
    ['missing-submit-handler.tsx', 1],
    ['mixed-submit-handlers.tsx', 1],
    ['duplicate-errors.tsx', 1],
    ['duplicate-submitting.tsx', 1],
    ['duplicate-value.tsx', 1],
    ['named-defaults.tsx', 1],
    ['rhf-owned.tsx', 0],
    ['url-mirror.tsx', 1],
    ['value-onchange-tunnel.tsx', 1],
    ['wrong-submit-owner.tsx', 1],
    ['zustand-mirror.tsx', 1],
  ]);
  const failures = [];
  for (const [name, count] of expected) {
    const actual = violations.filter((violation) => violation.includes(name)).length;
    if (actual !== count) {
      failures.push(`${name}: expected ${count} violation(s), received ${actual}`);
    }
  }
  if (failures.length) {
    console.error(
      ['Form ownership fixture audit failed:', ...failures.map((item) => `- ${item}`)].join('\n'),
    );
    process.exit(1);
  }
  console.log(
    'PASS: RHF ownership fixtures cover named defaults, cross-file fields, prop tunnels, Zustand, URL state, and approved workflow props.',
  );
  process.exit(0);
}

if (violations.length) {
  console.error(
    [
      'React Hook Form must exclusively own form values, validation errors, dirty state, and submitting state.',
      ...violations.map((item) => `- ${item}`),
    ].join('\n'),
  );
  process.exit(1);
}

console.log(`PASS: ${files.length} frontend source files respect React Hook Form ownership.`);
