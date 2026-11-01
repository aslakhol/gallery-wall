import type { Example } from "@/components/planner";
import clean from "./clean.jpg";
import room from "./room.jpg";

// A generated room run through the real analysis and cleanup once, so the planner can be tried without uploading.
export const example: Example = {
  photo: room.src,
  cleanUrl: clean.src,
  analysis: {
    art: [
      {
        label: "abstract painting",
        corners: {
          topLeft: { x: 214, y: 394 },
          topRight: { x: 333, y: 396 },
          bottomRight: { x: 330, y: 655 },
          bottomLeft: { x: 212, y: 653 },
        },
        widthCm: 70,
        heightCm: 90,
      },
      {
        label: "botanical print",
        corners: {
          topLeft: { x: 341, y: 494 },
          topRight: { x: 416, y: 495 },
          bottomRight: { x: 414, y: 653 },
          bottomLeft: { x: 339, y: 652 },
        },
        widthCm: 40,
        heightCm: 50,
      },
      {
        label: "black and white photograph",
        corners: {
          topLeft: { x: 426, y: 532 },
          topRight: { x: 491, y: 532 },
          bottomRight: { x: 490, y: 653 },
          bottomLeft: { x: 425, y: 652 },
        },
        widthCm: 30,
        heightCm: 40,
      },
      {
        label: "colourful abstract print",
        corners: {
          topLeft: { x: 500, y: 549 },
          topRight: { x: 545, y: 550 },
          bottomRight: { x: 544, y: 653 },
          bottomLeft: { x: 499, y: 652 },
        },
        widthCm: 21,
        heightCm: 30,
      },
      {
        label: "travel poster",
        corners: {
          topLeft: { x: 553, y: 483 },
          topRight: { x: 628, y: 483 },
          bottomRight: { x: 627, y: 653 },
          bottomLeft: { x: 552, y: 653 },
        },
        widthCm: 50,
        heightCm: 70,
      },
      {
        label: "line drawing",
        corners: {
          topLeft: { x: 636, y: 524 },
          topRight: { x: 698, y: 525 },
          bottomRight: { x: 698, y: 653 },
          bottomLeft: { x: 636, y: 653 },
        },
        widthCm: 30,
        heightCm: 40,
      },
      {
        label: "patterned textile art",
        corners: {
          topLeft: { x: 705, y: 538 },
          topRight: { x: 778, y: 539 },
          bottomRight: { x: 777, y: 653 },
          bottomLeft: { x: 704, y: 653 },
        },
        widthCm: 40,
        heightCm: 40,
      },
    ],
    wall: {
      surface: { left: 152, top: 119, right: 840, bottom: 653 },
      surfaceWidthCm: 400,
      hangAbove: { left: 188, right: 805, top: 653 },
    },
  },
};
