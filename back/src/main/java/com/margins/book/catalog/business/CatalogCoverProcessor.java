package com.margins.book.catalog.business;

import com.margins.book.catalog.provider.SourceFailure;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.nio.*;
import java.util.Iterator;
import javax.imageio.*;
import javax.imageio.stream.*;
import org.springframework.stereotype.Component;

@Component
public class CatalogCoverProcessor {
  public record Image(byte[] bytes, String mime, int width, int height) {}

  /** Serialize decode to bound peak heap independently of HTTP concurrency. */
  public synchronized Image minimize(byte[] bytes) {
    if (bytes == null || bytes.length < 12 || bytes.length > 5 * 1024 * 1024)
      throw new SourceFailure("INVALID_IMAGE");
    boolean jpeg = (bytes[0] & 255) == 255 && (bytes[1] & 255) == 216 && (bytes[2] & 255) == 255;
    boolean png = bytes[0] == (byte) 137 && bytes[1] == 80 && bytes[2] == 78 && bytes[3] == 71;
    if (!jpeg && !png) throw new SourceFailure("INVALID_IMAGE");
    try (var input = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
      Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
      if (!readers.hasNext()) throw new SourceFailure("INVALID_IMAGE");
      ImageReader reader = readers.next();
      try {
        reader.setInput(input, true, true);
        int width = reader.getWidth(0), height = reader.getHeight(0);
        if (width < 1 || height < 1 || (long) width * height > 20_000_000)
          throw new SourceFailure("INVALID_IMAGE");
        var param = reader.getDefaultReadParam();
        int sample = Math.max(1, Math.min(width / 320, height / 480));
        param.setSourceSubsampling(sample, sample, 0, 0);
        BufferedImage original = reader.read(0, param);
        int orientation = jpeg ? orientation(bytes) : 1;
        for (int[] bound : new int[][] {{160, 240}, {120, 180}, {80, 120}}) {
          BufferedImage scaled = scaled(original, bound[0], bound[1], orientation);
          for (float quality : new float[] {.65f, .5f, .35f}) {
            byte[] encoded = jpeg(scaled, quality);
            if (encoded.length <= 32768)
              return new Image(encoded, "image/jpeg", scaled.getWidth(), scaled.getHeight());
          }
        }
        throw new SourceFailure("INVALID_IMAGE");
      } finally {
        reader.dispose();
      }
    } catch (SourceFailure ex) {
      throw ex;
    } catch (IOException | RuntimeException ex) {
      throw new SourceFailure("INVALID_IMAGE");
    }
  }

  private BufferedImage scaled(BufferedImage image, int maxWidth, int maxHeight, int orientation) {
    boolean rotate = orientation >= 5;
    double ratio =
        Math.min(
            1,
            Math.min(
                (double) (rotate ? maxHeight : maxWidth) / image.getWidth(),
                (double) (rotate ? maxWidth : maxHeight) / image.getHeight()));
    int w = Math.max(1, (int) (image.getWidth() * ratio)),
        h = Math.max(1, (int) (image.getHeight() * ratio));
    BufferedImage small = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
    Graphics2D graphics = small.createGraphics();
    try {
      graphics.setColor(Color.WHITE);
      graphics.fillRect(0, 0, w, h);
      graphics.setRenderingHint(
          RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
      graphics.drawImage(image, 0, 0, w, h, null);
    } finally {
      graphics.dispose();
    }
    if (orientation == 1) return small;
    BufferedImage result =
        new BufferedImage(rotate ? h : w, rotate ? w : h, BufferedImage.TYPE_INT_RGB);
    for (int y = 0; y < h; y++)
      for (int x = 0; x < w; x++) {
        int dx = x, dy = y;
        switch (orientation) {
          case 2 -> dx = w - 1 - x;
          case 3 -> {
            dx = w - 1 - x;
            dy = h - 1 - y;
          }
          case 4 -> dy = h - 1 - y;
          case 5 -> {
            dx = y;
            dy = x;
          }
          case 6 -> {
            dx = h - 1 - y;
            dy = x;
          }
          case 7 -> {
            dx = h - 1 - y;
            dy = w - 1 - x;
          }
          case 8 -> {
            dx = y;
            dy = w - 1 - x;
          }
          default -> {}
        }
        result.setRGB(dx, dy, small.getRGB(x, y));
      }
    return result;
  }

  private byte[] jpeg(BufferedImage image, float quality) throws IOException {
    ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
    try (var bytes = new ByteArrayOutputStream();
        var output = new MemoryCacheImageOutputStream(bytes)) {
      writer.setOutput(output);
      var param = writer.getDefaultWriteParam();
      param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
      param.setCompressionQuality(quality);
      // No metadata from the source, including EXIF, comments or embedded profiles, is copied.
      writer.write(null, new IIOImage(image, null, null), param);
      output.flush();
      return bytes.toByteArray();
    } finally {
      writer.dispose();
    }
  }

  static int orientation(byte[] bytes) {
    try {
      for (int at = 2; at + 4 < bytes.length; ) {
        if ((bytes[at] & 255) != 255) break;
        int marker = bytes[at + 1] & 255;
        if (marker == 218 || marker == 217) break;
        int length = ((bytes[at + 2] & 255) << 8) | (bytes[at + 3] & 255);
        if (length < 2 || at + 2 + length > bytes.length) break;
        if (marker == 225
            && length >= 16
            && bytes[at + 4] == 'E'
            && bytes[at + 5] == 'x'
            && bytes[at + 6] == 'i'
            && bytes[at + 7] == 'f') {
          int base = at + 10, end = at + 2 + length;
          ByteBuffer data =
              ByteBuffer.wrap(bytes)
                  .order(bytes[base] == 'I' ? ByteOrder.LITTLE_ENDIAN : ByteOrder.BIG_ENDIAN);
          if (data.getShort(base + 2) != 42) return 1;
          long offset = Integer.toUnsignedLong(data.getInt(base + 4));
          if (offset < 8 || offset > end - base - 2) return 1;
          int directory = base + (int) offset,
              count = Short.toUnsignedInt(data.getShort(directory));
          for (int i = 0; i < count && directory + 2 + (i + 1) * 12 <= end; i++) {
            int entry = directory + 2 + i * 12;
            if (Short.toUnsignedInt(data.getShort(entry)) == 274
                && data.getShort(entry + 2) == 3
                && data.getInt(entry + 4) == 1) {
              int value = Short.toUnsignedInt(data.getShort(entry + 8));
              return value >= 1 && value <= 8 ? value : 1;
            }
          }
        }
        at += 2 + length;
      }
    } catch (IndexOutOfBoundsException ignored) {
    }
    return 1;
  }
}
