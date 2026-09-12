import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * Ship the data with the server bundle.
   *
   * The race and lap routes read their files at request time, by a path built
   * from the season and round, so the tracer cannot know which files a route
   * will want and has to infer it. Left alone it inferred most of them and
   * missed a few — the worst possible outcome, because the site builds,
   * deploys, and serves nearly every race correctly while a handful return 500
   * on a file that was never uploaded. Naming the directory removes the guess.
   */
  outputFileTracingIncludes: {
    "/**": ["./data/**/*"],
  },
};

export default nextConfig;
