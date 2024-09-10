import { registerFolder, FolderFunc } from './fold'

function preventUnfolding(stream, token) {
  // Get the CodeMirror instance
  const cm = stream.cm;

  // Intercept any existing markers that have an 'unfold' action
  // Disable or modify the behavior here to prevent the unfolding
  return null;  // Return null to indicate that unfolding is disabled
}

// Register this folder function for any tokens (e.g., images, links, etc.)
registerFolder("image", preventUnfolding, true);
registerFolder("link", preventUnfolding, true);
registerFolder("code", preventUnfolding, true);