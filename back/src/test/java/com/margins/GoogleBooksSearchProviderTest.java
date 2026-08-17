package com.margins;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.margins.book.dto.BookCandidateDto;
import com.margins.book.provider.BookSearchProperties;
import com.margins.book.provider.GoogleBooksSearchProvider;
import com.sun.net.httpserver.HttpServer;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class GoogleBooksSearchProviderTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void searchMapsGoogleBooksVolumesToBookCandidates() throws Exception {
        AtomicReference<String> requestQuery = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/books/v1/volumes", (exchange) -> {
            requestQuery.set(exchange.getRequestURI().getRawQuery());
            String body = """
                {
                  "totalItems": 1,
                  "items": [
                    {
                      "id": "abc123",
                      "volumeInfo": {
                        "title": "The Left Hand of Darkness",
                        "subtitle": "50th Anniversary Edition",
                        "authors": ["Ursula K. Le Guin"],
                        "publisher": "Ace",
                        "publishedDate": "2019-02-05",
                        "description": "A classic science fiction novel.",
                        "industryIdentifiers": [
                          { "type": "ISBN_10", "identifier": "0441478123" },
                          { "type": "ISBN_13", "identifier": "9780441478125" }
                        ],
                        "pageCount": 304,
                        "language": "en",
                        "imageLinks": {
                          "smallThumbnail": "http://books.google.com/small.jpg",
                          "thumbnail": "http://books.google.com/thumb.jpg"
                        }
                      }
                    }
                  ]
                }
                """;
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        GoogleBooksSearchProvider provider = new GoogleBooksSearchProvider(properties(), new ObjectMapper(), HttpClient.newHttpClient());

        List<BookCandidateDto> candidates = provider.search("title:The Left Hand of Darkness");

        assertThat(provider.providerName()).isEqualTo("google");
        assertThat(URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8))
            .contains("q=intitle:The Left Hand of Darkness")
            .contains("maxResults=5")
            .contains("startIndex=0")
            .contains("printType=books");
        assertThat(candidates).singleElement()
            .satisfies((candidate) -> {
                assertThat(candidate.getCandidateId()).isEqualTo("google:9780441478125");
                assertThat(candidate.getIsbn()).isEqualTo("9780441478125");
                assertThat(candidate.getIsbn10()).isEqualTo("0441478123");
                assertThat(candidate.getIsbn13()).isEqualTo("9780441478125");
                assertThat(candidate.getTitle()).isEqualTo("The Left Hand of Darkness");
                assertThat(candidate.getSubtitle()).isEqualTo("50th Anniversary Edition");
                assertThat(candidate.getAuthor()).isEqualTo("Ursula K. Le Guin");
                assertThat(candidate.getAuthors()).containsExactly("Ursula K. Le Guin");
                assertThat(candidate.getPublisher()).isEqualTo("Ace");
                assertThat(candidate.getPublishedDate()).isEqualTo("2019-02-05");
                assertThat(candidate.getPublishedYear()).isEqualTo(2019);
                assertThat(candidate.getDescription()).isEqualTo("A classic science fiction novel.");
                assertThat(candidate.getThumbnail()).isEqualTo("http://books.google.com/thumb.jpg");
                assertThat(candidate.getLanguage()).isEqualTo("en");
                assertThat(candidate.getPageCount()).isEqualTo(304);
                assertThat(candidate.getReason()).isNull();
            });
    }

    @Test
    void searchUsesStartIndexForRequestedPage() throws Exception {
        AtomicReference<String> requestQuery = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/books/v1/volumes", (exchange) -> {
            requestQuery.set(exchange.getRequestURI().getRawQuery());
            String body = "{\"totalItems\":45,\"items\":[]}";
            exchange.sendResponseHeaders(200, body.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        GoogleBooksSearchProvider provider = new GoogleBooksSearchProvider(properties(), new ObjectMapper(), HttpClient.newHttpClient());

        provider.search("dune", 3, 20);

        assertThat(URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8))
            .contains("q=dune")
            .contains("maxResults=20")
            .contains("startIndex=40");
    }

    @Test
    void searchDoesNotOverflowStartIndexForLargePage() throws Exception {
        AtomicReference<String> requestQuery = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/books/v1/volumes", (exchange) -> {
            requestQuery.set(exchange.getRequestURI().getRawQuery());
            String body = "{\"totalItems\":0,\"items\":[]}";
            exchange.sendResponseHeaders(200, body.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        GoogleBooksSearchProvider provider = new GoogleBooksSearchProvider(properties(), new ObjectMapper(), HttpClient.newHttpClient());

        provider.search("dune", Integer.MAX_VALUE, 40);

        assertThat(URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8))
            .contains("startIndex=2147483647")
            .doesNotContain("startIndex=-");
    }

    @Test
    void searchUsesIsbnQuerySyntaxForIsbnInputAndKeepsResultsWithoutIsbn() throws Exception {
        AtomicReference<String> requestQuery = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/books/v1/volumes", (exchange) -> {
            requestQuery.set(exchange.getRequestURI().getRawQuery());
            String body = """
                {
                  "items": [
                    {
                      "id": "no-isbn-id",
                      "volumeInfo": {
                        "title": "Untyped Metadata",
                        "authors": []
                      }
                    }
                  ]
                }
                """;
            exchange.sendResponseHeaders(200, body.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        GoogleBooksSearchProvider provider = new GoogleBooksSearchProvider(properties(), new ObjectMapper(), HttpClient.newHttpClient());

        List<BookCandidateDto> candidates = provider.search("978-0-441-47812-5");

        assertThat(URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8))
            .contains("q=isbn:9780441478125");
        assertThat(candidates).singleElement()
            .satisfies((candidate) -> {
                assertThat(candidate.getCandidateId()).isEqualTo("google:no-isbn-id");
                assertThat(candidate.getIsbn()).isNull();
                assertThat(candidate.getAuthor()).isEqualTo("Unknown author");
            });
    }

    @Test
    void searchNormalizesPrefixedIsbnInputWithSeparators() throws Exception {
        AtomicReference<String> requestQuery = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/books/v1/volumes", (exchange) -> {
            requestQuery.set(exchange.getRequestURI().getRawQuery());
            String body = "{\"items\":[]}";
            exchange.sendResponseHeaders(200, body.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        GoogleBooksSearchProvider provider = new GoogleBooksSearchProvider(properties(), new ObjectMapper(), HttpClient.newHttpClient());

        provider.search("isbn:978-0-441-47812-5");

        assertThat(URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8))
            .contains("q=isbn:9780441478125");
    }

    @Test
    void searchKeepsInvalidPrefixedIsbnInputAsFallbackQuery() throws Exception {
        AtomicReference<String> requestQuery = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/books/v1/volumes", (exchange) -> {
            requestQuery.set(exchange.getRequestURI().getRawQuery());
            String body = "{\"items\":[]}";
            exchange.sendResponseHeaders(200, body.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        GoogleBooksSearchProvider provider = new GoogleBooksSearchProvider(properties(), new ObjectMapper(), HttpClient.newHttpClient());

        provider.search("isbn:not an isbn");

        assertThat(URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8))
            .contains("q=isbn:not an isbn");
    }

    @Test
    void searchAddsGoogleBooksApiKeyWhenConfigured() throws Exception {
        AtomicReference<String> requestQuery = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/books/v1/volumes", (exchange) -> {
            requestQuery.set(exchange.getRequestURI().getRawQuery());
            String body = "{\"items\":[]}";
            exchange.sendResponseHeaders(200, body.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();
        BookSearchProperties properties = properties();
        properties.setGoogleApiKey("test-key");
        GoogleBooksSearchProvider provider = new GoogleBooksSearchProvider(properties, new ObjectMapper(), HttpClient.newHttpClient());

        provider.search("martian");

        assertThat(URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8))
            .contains("q=martian")
            .contains("key=test-key");
    }

    @Test
    void searchUsesAuthorQuerySyntaxForAuthorPrefixedInput() throws Exception {
        AtomicReference<String> requestQuery = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/books/v1/volumes", (exchange) -> {
            requestQuery.set(exchange.getRequestURI().getRawQuery());
            String body = "{\"items\":[]}";
            exchange.sendResponseHeaders(200, body.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        GoogleBooksSearchProvider provider = new GoogleBooksSearchProvider(properties(), new ObjectMapper(), HttpClient.newHttpClient());

        provider.search("author:Ursula K. Le Guin");

        assertThat(URLDecoder.decode(requestQuery.get(), StandardCharsets.UTF_8))
            .contains("q=inauthor:Ursula K. Le Guin");
    }

    @Test
    void searchReturnsEmptyWhenGoogleBooksReturnsNoItems() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/books/v1/volumes", (exchange) -> {
            String body = "{\"totalItems\":0}";
            exchange.sendResponseHeaders(200, body.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        GoogleBooksSearchProvider provider = new GoogleBooksSearchProvider(properties(), new ObjectMapper(), HttpClient.newHttpClient());

        assertThat(provider.search("missing")).isEmpty();
    }

    @Test
    void searchNormalizesCandidatesBeforeReturningFromProvider() throws Exception {
        server = HttpServer.create(new InetSocketAddress(0), 0);
        server.createContext("/books/v1/volumes", (exchange) -> {
            String body = """
                {
                  "items": [
                    {
                      "id": "  google-id  ",
                      "volumeInfo": {
                        "title": "  %s  ",
                        "authors": ["  Author  ", "   "],
                        "industryIdentifiers": [
                          { "type": "ISBN_13", "identifier": " 978-0-441-47812-5 " }
                        ]
                      }
                    },
                    {
                      "id": "blank-title",
                      "volumeInfo": { "title": "   ", "authors": ["Author"] }
                    }
                  ]
                }
                """.formatted("T".repeat(300));
            exchange.sendResponseHeaders(200, body.getBytes(StandardCharsets.UTF_8).length);
            try (OutputStream output = exchange.getResponseBody()) {
                output.write(body.getBytes(StandardCharsets.UTF_8));
            }
        });
        server.start();

        GoogleBooksSearchProvider provider = new GoogleBooksSearchProvider(
            properties(),
            new ObjectMapper(),
            HttpClient.newHttpClient()
        );

        assertThat(provider.search("normalized candidate")).singleElement()
            .satisfies(candidate -> {
                assertThat(candidate.getCandidateId()).isEqualTo("google:9780441478125");
                assertThat(candidate.getIsbn()).isEqualTo("9780441478125");
                assertThat(candidate.getTitle()).hasSize(255).doesNotStartWith(" ");
                assertThat(candidate.getAuthor()).isEqualTo("Author");
                assertThat(candidate.getAuthors()).containsExactly("Author");
            });
    }

    private BookSearchProperties properties() {
        BookSearchProperties properties = new BookSearchProperties();
        properties.setGoogleBaseUrl("http://127.0.0.1:" + server.getAddress().getPort());
        return properties;
    }
}
