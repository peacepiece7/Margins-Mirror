// Product runtime configuration must not enter the credential-free local gate.
// Toolchain settings remain available; explicit local fixtures supply their own overrides.
const jvmOptionVariables = new Set([
  "JAVA_TOOL_OPTIONS",
  "_JAVA_OPTIONS",
  "JDK_JAVA_OPTIONS",
  "JAVA_OPTS",
  "GRADLE_OPTS",
]);

function safeJvmOptions(value) {
  const tokens = [];
  let token = "",
    quote = "",
    escaped = false;
  for (const character of value) {
    if (escaped) {
      token += character;
      escaped = false;
      continue;
    }
    if (character === "\\") {
      token += character;
      escaped = true;
      continue;
    }
    if (quote) {
      token += character;
      if (character === quote) quote = "";
    } else if (character === '"' || character === "'") {
      token += character;
      quote = character;
    } else if (/\s/.test(character)) {
      if (token) tokens.push(token);
      token = "";
    } else token += character;
  }
  if (quote || escaped) return "";
  if (token) tokens.push(token);
  return tokens
    .filter((raw) => {
      const option = raw.replace(/^(["'])(.*)\1$/, "$2");
      return (
        /^-X(?:ms|mx|ss)\d+[kKmMgG]?$/.test(option) ||
        /^-XX:(?:[+-](?:UseG1GC|UseSerialGC|UseParallelGC|UseZGC|UseStringDeduplication)|(?:MaxRAMPercentage|InitialRAMPercentage|MinRAMPercentage|ActiveProcessorCount|ParallelGCThreads|ConcGCThreads|MaxMetaspaceSize|ReservedCodeCacheSize)=\d+(?:\.\d+)?[kKmMgG]?)$/.test(
          option,
        ) ||
        /^-(?:ea|da|esa|dsa)$/.test(option) ||
        /^-D(?:file.encoding|sun.jnu.encoding|user.language|user.country|user.timezone)=(?:[\w./:+-]+|"[\w./:+-]+"|'[\w./:+-]+')$/.test(
          option,
        )
      );
    })
    .join(" ");
}

export function isolatedTestEnvironment(environment, overrides = {}) {
  const inherited = Object.fromEntries(
    Object.entries(environment)
      .filter(
        ([key]) =>
          key.toUpperCase() === "MARGINS_GRADLE_VERSION" ||
          !/^(MARGINS_|VITE_MARGINS_|OPENAI_|LANGFUSE_|RESEND_|GOOGLE_|KAKAO_|NL_SEOJI_|NAVER_|SPRING_|OTEL_|SERVER_)/.test(
            key.replace(/[.-]/g, "_").toUpperCase(),
          ),
      )
      .map(([key, value]) => [
        key.toUpperCase() === "MARGINS_GRADLE_VERSION"
          ? "MARGINS_GRADLE_VERSION"
          : key,
        value,
      ]),
  );
  for (const [key, value] of Object.entries(inherited)) {
    if (!jvmOptionVariables.has(key.toUpperCase())) continue;
    const safe = safeJvmOptions(value);
    if (safe) inherited[key] = safe;
    else delete inherited[key];
  }
  return {
    ...inherited,
    MARGINS_VERIFICATION_ISOLATED: "true",
    MARGINS_DB_TARGET: "local",
    MARGINS_AI_PROVIDER: "placeholder",
    MARGINS_GOOGLE_OAUTH_ENABLED: "false",
    MARGINS_GOOGLE_MOBILE_OAUTH_ENABLED: "false",
    MARGINS_NATIVE_TURNSTILE_BRIDGE_ENABLED: "false",
    MARGINS_MAIL_VERIFICATION_ENABLED: "false",
    MARGINS_CONTACT_ENABLED: "false",
    MARGINS_CATALOG_WORKER_ENABLED: "false",
    LANGFUSE_ENABLED: "false",
    LANGFUSE_INTEGRATION_TEST_ENABLED: "false",
    OPENAI_API_KEY: "",
    RESEND_API_KEY: "",
    LANGFUSE_PUBLIC_KEY: "",
    LANGFUSE_SECRET_KEY: "",
    GOOGLE_BOOKS_API_KEY: "",
    KAKAO_REST_API_KEY: "",
    NL_SEOJI_API_KEY: "",
    NAVER_CLIENT_ID: "",
    NAVER_CLIENT_SECRET: "",
    ...overrides,
  };
}

export function replaceProcessEnvironment(environment) {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, environment);
}
