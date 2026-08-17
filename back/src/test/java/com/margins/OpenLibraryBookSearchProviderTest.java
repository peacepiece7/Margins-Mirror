package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.book.provider.BookSearchProperties;
import com.margins.book.provider.BookSearchResult;
import com.margins.book.provider.OpenLibraryBookSearchProvider;
import com.sun.net.httpserver.HttpServer;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class OpenLibraryBookSearchProviderTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void searchNormalizesAndValidatesCandidatesAtProviderBoundary() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/search.json", exchange -> {
            String body = """
                {
                  "numFound": 2,
                  "docs": [
                    {
                      "key": "  /works/OL27448W  ",
                      "title": "  %s  ",
                      "author_name": ["  Frank Herbert  "],
                      "first_publish_year": 1965
                    },
                    {
                      "key": "/works/invalid",
                      "title": "   ",
                      "author_name": ["Author"]
                    }
                  ]
                }
                """.formatted("D".repeat(300));
            exchange.sendResponseHeaders(200, body.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        BookSearchProperties properties = new BookSearchProperties();
        properties.setBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
        OpenLibraryBookSearchProvider provider = new OpenLibraryBookSearchProvider(
            properties,
            new ObjectMapper(),
            HttpClient.newHttpClient()
        );

        BookSearchResult result = provider.search("Dune", 1, 5);

        assertThat(result.getTotalItems()).isEqualTo(2);
        assertThat(result.getCandidates()).singleElement()
            .satisfies(candidate -> {
                assertThat(candidate.getCandidateId()).isEqualTo("openlibrary:/works/OL27448W");
                assertThat(candidate.getTitle()).hasSize(255).doesNotStartWith(" ");
                assertThat(candidate.getAuthor()).isEqualTo("Frank Herbert");
                assertThat(candidate.getPublishedYear()).isEqualTo(1965);
            });
    }
}
