package com.margins.book.catalog.provider;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.margins.book.catalog.config.CatalogProperties;
import com.margins.book.catalog.model.CatalogRows.Source;
import java.io.InterruptedIOException;
import java.net.URI;
import java.util.Map;
import java.util.concurrent.*;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.core5.http.ClassicHttpRequest;
import org.apache.hc.core5.http.io.HttpClientResponseHandler;
import org.apache.hc.core5.http.message.BasicClassicHttpResponse;
import org.apache.hc.core5.util.Timeout;
import org.junit.jupiter.api.Test;

class CatalogHttpClientTest {
  private Source source(String code) {
    var source = new Source();
    source.setId(1L);
    source.setCode(code);
    return source;
  }

  @Test
  void requestAndCancellationUseTheSameSourceSpecificBudget() throws Exception {
    var properties = new CatalogProperties();
    var transport = mock(CloseableHttpClient.class);
    var timers = mock(ScheduledExecutorService.class);
    var scheduled = mock(ScheduledFuture.class);
    doReturn(scheduled).when(timers).schedule(any(Runnable.class), anyLong(), eq(TimeUnit.SECONDS));
    when(transport.execute(any(ClassicHttpRequest.class), any(HttpClientResponseHandler.class)))
        .thenAnswer(
            call -> {
              HttpGet request = call.getArgument(0);
              int seconds = request.getUri().getHost().equals("openlibrary.org") ? 25 : 10;
              assertThat(request.getConfig().getResponseTimeout())
                  .isEqualTo(Timeout.ofSeconds(seconds));
              HttpClientResponseHandler<?> handler = call.getArgument(1);
              return handler.handleResponse(new BasicClassicHttpResponse(200));
            });
    var http = new CatalogHttpClient(mock(CatalogSourceGate.class), properties, transport, timers);
    try {
      http.get(
          source("open_library"),
          URI.create("https://openlibrary.org/search.json?q=momo"),
          Map.of(),
          false,
          1024);
      http.get(
          source("google_books"),
          URI.create("https://www.googleapis.com/books/v1/volumes?q=momo"),
          Map.of(),
          false,
          1024);
      http.get(
          source("open_library"),
          URI.create("https://covers.openlibrary.org/b/id/1-M.jpg"),
          Map.of(),
          true,
          1024);
      verify(timers).schedule(any(Runnable.class), eq(25L), eq(TimeUnit.SECONDS));
      verify(timers, times(2)).schedule(any(Runnable.class), eq(10L), eq(TimeUnit.SECONDS));
      verify(scheduled, times(3)).cancel(false);
    } finally {
      http.close();
    }
  }

  @Test
  void responseBeyondOldFiveSecondCutoffSucceedsWithinOpenLibraryBudget() throws Exception {
    var transport = mock(CloseableHttpClient.class);
    when(transport.execute(any(ClassicHttpRequest.class), any(HttpClientResponseHandler.class)))
        .thenAnswer(
            call -> {
              HttpGet request = call.getArgument(0);
              Thread.sleep(6100);
              if (request.isCancelled()) throw new InterruptedIOException();
              HttpClientResponseHandler<?> handler = call.getArgument(1);
              return handler.handleResponse(new BasicClassicHttpResponse(200));
            });
    var http =
        new CatalogHttpClient(
            mock(CatalogSourceGate.class),
            new CatalogProperties(),
            transport,
            Executors.newSingleThreadScheduledExecutor());
    try {
      assertThat(
              http.get(
                      source("open_library"),
                      URI.create("https://openlibrary.org/search.json?q=momo"),
                      Map.of(),
                      false,
                      1024)
                  .status())
          .isEqualTo(200);
    } finally {
      http.close();
    }
  }

  @Test
  void deadlineCancelsBlockedTransportAndReturnsOnlySafeError() throws Exception {
    var properties = new CatalogProperties();
    properties.setOpenLibraryTimeoutSeconds(1);
    var transport = mock(CloseableHttpClient.class);
    when(transport.execute(any(ClassicHttpRequest.class), any(HttpClientResponseHandler.class)))
        .thenAnswer(
            call -> {
              HttpGet request = call.getArgument(0);
              long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(4);
              while (!request.isCancelled() && System.nanoTime() < deadline) Thread.sleep(10);
              assertThat(request.isCancelled()).isTrue();
              throw new InterruptedIOException("upstream secret must not escape");
            });
    var http =
        new CatalogHttpClient(
            mock(CatalogSourceGate.class),
            properties,
            transport,
            Executors.newSingleThreadScheduledExecutor());
    try {
      assertThatThrownBy(
              () ->
                  http.get(
                      source("open_library"),
                      URI.create("https://openlibrary.org/search.json?q=momo"),
                      Map.of(),
                      false,
                      1024))
          .isInstanceOf(SourceFailure.class)
          .hasMessage("TIMEOUT")
          .hasCause(null);
    } finally {
      http.close();
    }
  }
}
