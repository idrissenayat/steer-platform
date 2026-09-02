import methodology from "../../kit/canon/methodology.md?raw";
import framework from "../../kit/canon/framework.md?raw";
import operatingModel from "../../kit/canon/operating-model.md?raw";
import sizingAndScoping from "../../kit/practices/sizing-and-scoping.md?raw";
import providingIntent from "../../kit/practices/providing-intent.md?raw";
import threeSurfaces from "../../kit/practices/three-surfaces.md?raw";
import glossary from "../../kit/canon/glossary.md?raw";
import guidebook from "../../kit/canon/guidebook.md?raw";
import manifest from "../../kit/learn-manifest.json";
import version from "../../kit/version.json";
import type { LearnManifest } from "@steer/domain/learn";

export const learnSources: Record<string, string> = {
  methodology,
  framework,
  "operating-model": operatingModel,
  "sizing-and-scoping": sizingAndScoping,
  "providing-intent": providingIntent,
  "three-surfaces": threeSurfaces,
  glossary,
  guidebook,
};

export const learnManifest = manifest as LearnManifest;
export const kitVersion = version;
