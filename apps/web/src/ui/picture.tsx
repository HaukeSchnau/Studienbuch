/**
 * An image served as AVIF, WebP or PNG, whichever the browser takes first.
 *
 * `source` is the path without an extension; all three encodings are generated from the same PNG
 * and sit beside it. The hero render alone drops from 616 KB to 162 KB this way, and it is the
 * largest thing a visitor waits for — a hero that arrives late undoes a lot of careful work
 * elsewhere.
 *
 * `priority` marks the one image above the fold: it is fetched eagerly and at high priority, while
 * everything else is lazy. Width and height are required so the browser can reserve the space and
 * the page does not jump as images land.
 */
export const Picture = ({
  alt,
  className,
  height,
  priority = false,
  source,
  width,
}: {
  alt: string;
  className?: string;
  height: number;
  priority?: boolean;
  source: string;
  width: number;
}) => (
  <picture>
    <source srcSet={`${source}.avif`} type="image/avif" />
    <source srcSet={`${source}.webp`} type="image/webp" />
    <img
      alt={alt}
      className={className}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      height={height}
      loading={priority ? "eager" : "lazy"}
      src={`${source}.png`}
      width={width}
    />
  </picture>
);
