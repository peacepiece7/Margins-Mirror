package com.margins.book.catalog.provider;

import com.margins.book.catalog.config.CatalogProperties;
import com.margins.book.catalog.model.CatalogRows.Source;
import jakarta.annotation.PreDestroy;
import java.io.*;
import java.net.*;
import java.time.*;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.*;
import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.config.ConnectionConfig;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.*;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.core5.util.Timeout;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

@Component
public class CatalogHttpClient {
  public record Response(byte[] body, String contentType, int status, String cacheControl) {
    public Response(byte[] body, String contentType, int status) {
      this(body, contentType, status, null);
    }
  }

  private final CatalogSourceGate gate;
  private final CatalogProperties properties;
  private final CloseableHttpClient client;
  private final ScheduledExecutorService cancellations;

  @Autowired
  public CatalogHttpClient(CatalogSourceGate gate, CatalogProperties properties) {
    this(
        gate,
        properties,
        createClient(properties),
        Executors.newSingleThreadScheduledExecutor(
            r -> {
              Thread thread = new Thread(r, "catalog-http-deadline");
              thread.setDaemon(true);
              return thread;
            }));
  }

  CatalogHttpClient(
      CatalogSourceGate gate,
      CatalogProperties properties,
      CloseableHttpClient client,
      ScheduledExecutorService cancellations) {
    this.gate = gate;
    this.properties = properties;
    this.client = client;
    this.cancellations = cancellations;
  }

  private static CloseableHttpClient createClient(CatalogProperties properties) {
    var manager =
        PoolingHttpClientConnectionManagerBuilder.create()
            .setMaxConnTotal(4)
            .setMaxConnPerRoute(2)
            .setDnsResolver(
                new DnsResolver() {
                  public InetAddress[] resolve(String host) throws UnknownHostException {
                    InetAddress[] addresses = InetAddress.getAllByName(host);
                    if (addresses.length == 0
                        || Arrays.stream(addresses)
                            .anyMatch(ip -> !CatalogUrlPolicy.publicAddress(ip)))
                      throw new UnknownHostException("Blocked catalog destination");
                    return addresses;
                  }

                  public String resolveCanonicalHostname(String host) {
                    return host;
                  }
                })
            .setDefaultConnectionConfig(
                ConnectionConfig.custom()
                    .setConnectTimeout(Timeout.ofSeconds(2))
                    .setSocketTimeout(
                        Timeout.ofSeconds(
                            Math.max(
                                properties.getRequestTimeoutSeconds(),
                                Math.max(
                                    properties.getOpenLibraryTimeoutSeconds(),
                                    properties.getCoverTimeoutSeconds()))))
                    .build())
            .build();
    return HttpClients.custom()
        .setConnectionManager(manager)
        .disableRedirectHandling()
        .disableAutomaticRetries()
        .disableContentCompression()
        .disableCookieManagement()
        .setUserAgent(properties.getUserAgent())
        .setDefaultRequestConfig(
            RequestConfig.custom()
                .setConnectionRequestTimeout(Timeout.ofSeconds(2))
                .setResponseTimeout(Timeout.ofSeconds(properties.getRequestTimeoutSeconds()))
                .build())
        .build();
  }

  public Response get(
      Source source, URI initial, Map<String, String> headers, boolean cover, int maximumBytes) {
    URI uri = initial;
    for (int hop = 0; hop < 3; hop++) {
      CatalogUrlPolicy.validate(source.getCode(), uri);
      long wait = gate.reserve(source.getId(), cover, LocalDateTime.now(ZoneOffset.UTC));
      try {
        if (wait > 0) Thread.sleep(wait);
      } catch (InterruptedException ex) {
        Thread.currentThread().interrupt();
        throw new SourceFailure("TIMEOUT");
      }
      var request = new HttpGet(uri);
      int timeout = properties.timeoutSeconds(source.getCode(), cover);
      request.setConfig(
          RequestConfig.custom()
              .setConnectionRequestTimeout(Timeout.ofSeconds(2))
              .setResponseTimeout(Timeout.ofSeconds(timeout))
              .build());
      request.setHeader("Accept-Encoding", "identity");
      headers.forEach(request::setHeader);
      var cancellation =
          cancellations.schedule((Runnable) request::cancel, timeout, TimeUnit.SECONDS);
      try {
        var response =
            client.execute(
                request,
                r -> {
                  int status = r.getCode();
                  if (status >= 300 && status < 400) {
                    String location =
                        r.getFirstHeader("Location") == null
                            ? null
                            : r.getFirstHeader("Location").getValue();
                    if (location == null) throw new SourceFailure("INVALID_RESPONSE");
                    return new Wire(status, location, null, null, null);
                  }
                  if (status == 429)
                    throw new SourceFailure(
                        "RATE_LIMITED",
                        retryAfter(
                            r.getFirstHeader("Retry-After") == null
                                ? null
                                : r.getFirstHeader("Retry-After").getValue()));
                  if (status == 401 || status == 403) throw new SourceFailure("BLOCKED", 86400);
                  if (status >= 500) throw new SourceFailure("UPSTREAM_ERROR");
                  if (status != 200 && status != 404) throw new SourceFailure("INVALID_RESPONSE");
                  if (r.getEntity() != null && r.getEntity().getContentLength() > maximumBytes)
                    throw new SourceFailure("TOO_LARGE");
                  byte[] body;
                  try (InputStream stream =
                      r.getEntity() == null
                          ? InputStream.nullInputStream()
                          : r.getEntity().getContent()) {
                    body = stream.readNBytes(maximumBytes + 1);
                  }
                  if (body.length > maximumBytes) throw new SourceFailure("TOO_LARGE");
                  return new Wire(
                      status,
                      null,
                      r.getEntity() == null ? "" : r.getEntity().getContentType(),
                      body,
                      r.getFirstHeader("Cache-Control") == null
                          ? null
                          : r.getFirstHeader("Cache-Control").getValue());
                });
        if (response.location != null) {
          URI next = uri.resolve(response.location);
          // Never forward API authorization to another host, even an allowlisted image host.
          if (!Objects.equals(uri.getHost(), next.getHost()) && !headers.isEmpty())
            throw new SourceFailure("BLOCKED");
          uri = next;
          continue;
        }
        return new Response(
            response.body, response.contentType, response.status, response.cacheControl);
      } catch (SourceFailure ex) {
        throw ex;
      } catch (Exception ex) {
        throw new SourceFailure("TIMEOUT");
      } finally {
        cancellation.cancel(false);
      }
    }
    throw new SourceFailure("BLOCKED");
  }

  private record Wire(
      int status, String location, String contentType, byte[] body, String cacheControl) {}

  static int retryAfter(String value) {
    if (value == null) return 60;
    try {
      return Math.max(1, Integer.parseInt(value));
    } catch (RuntimeException ex) {
      try {
        return (int)
            Math.min(
                86400,
                Math.max(
                    1,
                    Duration.between(
                            Instant.now(),
                            ZonedDateTime.parse(value, DateTimeFormatter.RFC_1123_DATE_TIME)
                                .toInstant())
                        .toSeconds()));
      } catch (RuntimeException ignored) {
        return 60;
      }
    }
  }

  @PreDestroy
  public void close() throws IOException {
    cancellations.shutdownNow();
    client.close();
  }
}
