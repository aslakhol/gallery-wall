import type { Example } from "@/components/planner";
import clean from "./clean.jpg";
import room from "./room.jpg";

// A generated room run through the real analysis and cleanup once, so the planner can be tried without uploading.
export const example: Example = {
  photo: room.src,
  cleanUrl: clean.src,
  hidden: ["square textile art"],
  analysis: {
    art: [
      {
        label: "abstract painting",
        corners: {
          topLeft: { x: 213, y: 395 },
          topRight: { x: 333, y: 398 },
          bottomRight: { x: 332, y: 655 },
          bottomLeft: { x: 211, y: 656 },
        },
        widthCm: 60,
        heightCm: 80,
      },
      {
        label: "botanical print",
        corners: {
          topLeft: { x: 336, y: 494 },
          topRight: { x: 412, y: 497 },
          bottomRight: { x: 411, y: 654 },
          bottomLeft: { x: 336, y: 654 },
        },
        widthCm: 40,
        heightCm: 50,
      },
      {
        label: "coastal seascape print",
        corners: {
          topLeft: { x: 414, y: 517 },
          topRight: { x: 516, y: 518 },
          bottomRight: { x: 516, y: 653 },
          bottomLeft: { x: 414, y: 652 },
        },
        widthCm: 50,
        heightCm: 40,
      },
      {
        label: "vintage travel poster",
        corners: {
          topLeft: { x: 553, y: 483 },
          topRight: { x: 628, y: 484 },
          bottomRight: { x: 628, y: 653 },
          bottomLeft: { x: 553, y: 652 },
        },
        widthCm: 40,
        heightCm: 50,
      },
      {
        label: "landscape watercolor print",
        corners: {
          topLeft: { x: 629, y: 537 },
          topRight: { x: 709, y: 538 },
          bottomRight: { x: 709, y: 656 },
          bottomLeft: { x: 629, y: 655 },
        },
        widthCm: 40,
        heightCm: 30,
      },
      {
        label: "square textile art",
        corners: {
          topLeft: { x: 715, y: 538 },
          topRight: { x: 782, y: 538 },
          bottomRight: { x: 782, y: 657 },
          bottomLeft: { x: 715, y: 657 },
        },
        widthCm: 35,
        heightCm: 35,
      },
    ],
    wall: {
      surface: { left: 153, top: 118, right: 840, bottom: 654 },
      surfaceWidthCm: 420,
      hangAbove: { left: 188, right: 805, top: 654 },
    },
  },
};
