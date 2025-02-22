import { getPreferenceValues, LocalStorage, open, showHUD, showToast, Toast } from "@raycast/api";
import fs from "fs";
import Values = LocalStorage.Values;
import { homedir } from "os";
import { runAppleScript } from "run-applescript";
import { exec } from "child_process";
import {
  DESIRED_RAYCAST_WIDTH_IN_METADATA_PX,
  METADATA_HEIGHT_PX,
  METADATA_PADDING_X_PX,
  METADATA_PADDING_Y_PX,
  METADATA_WIDTH_PX,
} from "./constants";

export const preferences = () => {
  const preferencesMap = new Map(Object.entries(getPreferenceValues<Values>()));
  return {
    screenshotName: preferencesMap.get("screenshotName") as string,
    screenshotFormat: preferencesMap.get("screenshotFormat") as string,
  };
};
export const isEmpty = (string: string | null | undefined) => {
  return !(string != null && String(string).length > 0);
};

export const checkDirectoryExists = (filePath: string) => {
  try {
    fs.accessSync(filePath);
    return true;
  } catch (e) {
    return false;
  }
};

type CaptureResult = {
  captureSuccess: boolean;
  picturePath: string;
  errorMassage: string;
};

type RaycastLocation = {
  x: number;
  y: number;
};

type RaycastSize = {
  w: number;
  h: number;
};

export async function getRaycastLocation() {
  const script = `
tell application "System Events"
    tell process "Raycast"
        set b to position of back window  
    end tell
end tell`;
  try {
    const result = await runAppleScript(script);
    const raycastLocation = result.split(", ");
    return [parseInt(raycastLocation[0]), parseInt(raycastLocation[1])];
  } catch (e) {
    return [-1, -1];
  }
}

export async function getRaycastSize() {
  const script = `
tell application "System Events"
    tell process "Raycast"
        set b to size of back window  
    end tell
end tell`;
  try {
    const result = await runAppleScript(script);
    const raycastSize = result.split(", ");
    return [parseInt(raycastSize[0]), parseInt(raycastSize[1])];
  } catch (e) {
    return [-1, -1];
  }
}

export async function captureRaycastMetadata(raycastLocation: RaycastLocation, raycastSize: RaycastSize) {
  try {
    return await captureWithInternalMonitor(raycastLocation, raycastSize);
  } catch (e) {
    console.error(String(e));
    return { captureSuccess: false, picturePath: homedir() + "/Downloads/", errorMassage: String(e) };
  }
}

export async function captureWithInternalMonitor(raycastLocation: RaycastLocation, raycastSize: RaycastSize) {
  const { screenshotName, screenshotFormat } = preferences();
  const finalScreenshotName = isEmpty(screenshotName) ? "Metadata" : screenshotName;
  const scale = DESIRED_RAYCAST_WIDTH_IN_METADATA_PX / raycastSize.w;

  const picturePath = `${homedir()}/Downloads/${await checkFileExists(
    `${homedir()}/Downloads/`,
    finalScreenshotName,
    screenshotFormat
  )}`;
  const viewX = `${raycastLocation.x - METADATA_PADDING_X_PX / scale}`;
  const viewY = `${raycastLocation.y - METADATA_PADDING_Y_PX / scale}`;
  const viewW = `${METADATA_WIDTH_PX / scale}`;
  const viewH = `${METADATA_HEIGHT_PX / scale}`;
  const command = `/usr/sbin/screencapture -x -t ${screenshotFormat} -R ${viewX},${viewY},${viewW},${viewH} ${picturePath}`;
  exec(command);
  return { captureSuccess: true, picturePath: picturePath, errorMassage: "" };
}

export async function captureResultToast(captureResult: CaptureResult) {
  if (captureResult.captureSuccess) {
    const optionsToast: Toast.Options = {
      title: "Capture Success!",
      style: Toast.Style.Success,
      message: "Metadata saved in Download.",
      primaryAction: {
        title: "Open in Finder",
        onAction: async () => {
          await open(captureResult.picturePath);
          await showHUD("Open metadata in default app");
        },
      },
      secondaryAction: {
        title: "Reveal in Finder",
        onAction: async () => {
          await open(homedir() + "/Downloads/");
          await showHUD("Reveal metadata in Finder");
        },
      },
    };
    await showToast(optionsToast);
  } else {
    await showToast({
      title: "Capture Failure!",
      style: Toast.Style.Failure,
      message: captureResult.errorMassage,
    });
  }
}

export async function checkFileExists(path: string, name: string, extension: string) {
  const directoryExists = await checkDirectoryExists(path + name + "." + extension);
  if (!directoryExists) {
    return name + "." + extension;
  } else {
    let index = 2;
    while (directoryExists) {
      const newName = name + "-" + index + "." + extension;
      const directoryExists = await checkDirectoryExists(path + newName);
      if (!directoryExists) {
        return newName;
      }
      index++;
    }
    return name;
  }
}
