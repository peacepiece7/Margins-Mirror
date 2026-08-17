package com.margins.testsupport;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class ContractTextSupport {

    private ContractTextSupport() {
    }

    public static String readNormalized(Path path) throws IOException {
        return Files.readString(path).replace("\r\n", "\n");
    }
}
