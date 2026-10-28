package com.margins.book.catalog.provider;

import com.margins.book.catalog.model.CatalogRows.Source;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
public class CatalogRobots {
  private final CatalogHttpClient http;
  private final Map<String, Cached> cache = new LinkedHashMap<>();

  private record Cached(String text, Instant expires) {}

  private record Rule(String path, boolean allow) {}

  public void requireAllowed(Source source, URI uri) {
    String host = uri.getHost();
    Cached cached;
    synchronized (cache) {
      cached = cache.get(host);
    }
    if (cached == null || !cached.expires().isAfter(Instant.now())) {
      var response =
          http.get(source, URI.create("https://" + host + "/robots.txt"), Map.of(), false, 65536);
      String text =
          response.status() == 404 ? "" : new String(response.body(), StandardCharsets.UTF_8);
      if (response.status() != 200 && response.status() != 404) throw new SourceFailure("BLOCKED");
      if (text.stripLeading().startsWith("<")) throw new SourceFailure("INVALID_RESPONSE");
      cached = new Cached(text, Instant.now().plusSeconds(cacheSeconds(response.cacheControl())));
      synchronized (cache) {
        if (cache.size() >= 32) cache.remove(cache.keySet().iterator().next());
        cache.put(host, cached);
      }
    }
    String target = uri.getRawPath() + (uri.getRawQuery() == null ? "" : "?" + uri.getRawQuery());
    if (!allows(cached.text(), target)) throw new SourceFailure("BLOCKED");
  }

  public static long cacheSeconds(String cacheControl) {
    long seconds = 86400;
    if (cacheControl == null) return seconds;
    for (String raw : cacheControl.toLowerCase(Locale.ROOT).split(",")) {
      String directive = raw.strip();
      if (Set.of("no-store", "no-cache").contains(directive)) return 0;
      if (directive.startsWith("max-age=")) {
        try {
          seconds =
              Math.min(
                  seconds, Math.max(0, Long.parseLong(directive.substring(8).replace("\"", ""))));
        } catch (NumberFormatException ignored) {
          return 0;
        }
      }
    }
    return seconds;
  }

  /** RFC9309 longest matching path; equally specific Allow wins. Unknown directives are ignored. */
  public static boolean allows(String robots, String target) {
    List<Rule> wildcard = new ArrayList<>(), specific = new ArrayList<>();
    List<String> agents = new ArrayList<>();
    boolean sawRule = false;
    boolean hasSpecific = false;
    for (String raw : robots.split("\\R")) {
      String line = raw.split("#", 2)[0].strip();
      int colon = line.indexOf(':');
      if (colon < 0) continue;
      String key = line.substring(0, colon).strip().toLowerCase(Locale.ROOT),
          value = line.substring(colon + 1).strip();
      if (key.equals("user-agent")) {
        if (sawRule) {
          agents.clear();
          sawRule = false;
        }
        String agent = value.toLowerCase(Locale.ROOT);
        if (!agent.isEmpty() && !agent.equals("*") && "marginsbookcatalog".contains(agent))
          hasSpecific = true;
        agents.add(agent);
        continue;
      }
      if (!key.equals("allow") && !key.equals("disallow")) continue;
      sawRule = true;
      if (value.isEmpty()) continue;
      Rule rule = new Rule(value, key.equals("allow"));
      if (agents.stream().anyMatch(a -> !a.equals("*") && "marginsbookcatalog".contains(a)))
        specific.add(rule);
      else if (agents.contains("*")) wildcard.add(rule);
    }
    List<Rule> rules = hasSpecific ? specific : wildcard;
    int longest = -1;
    boolean allow = true;
    for (Rule rule : rules) {
      String path = rule.path();
      boolean end = path.endsWith("$");
      if (end) path = path.substring(0, path.length() - 1);
      String regex =
          Arrays.stream(path.split("\\*", -1))
              .map(java.util.regex.Pattern::quote)
              .collect(java.util.stream.Collectors.joining(".*"));
      if (java.util.regex.Pattern.compile("^" + regex + (end ? "$" : "")).matcher(target).find()) {
        int length = path.replace("*", "").length();
        if (length > longest || (length == longest && rule.allow())) {
          longest = length;
          allow = rule.allow();
        }
      }
    }
    return allow;
  }
}
