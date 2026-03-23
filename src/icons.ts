import fileExtensions from "./icons/fileExtensions";
import fileNames from "./icons/fileNames";
import folderNames from "./icons/folderNames";
import folderNamesExpanded from "./icons/folderNamesExpanded";

function icon(name: string) {
  return {
    [`_f_${name}`]: {
      iconPath: `./icons/${name}.svg`,
    },
  };
}

function iconGeneric(name: string) {
  return {
    [`_${name}`]: {
      iconPath: `./icons/${name}.svg`,
    },
  };
}

function folderIcon(name: string) {
  return {
    [`_fd_${name}`]: {
      iconPath: `./icons/${name}.svg`,
    },
  };
}

const icons = {
  ...iconGeneric("file"),
  ...iconGeneric("folder"),
  ...iconGeneric("folder_open"),
  ...folderIcon("folder_app"),
  ...folderIcon("folder_app_open"),
  ...folderIcon("folder_src"),
  ...folderIcon("folder_src_open"),
  ...folderIcon("folder_dist"),
  ...folderIcon("folder_dist_open"),
  ...folderIcon("folder_node"),
  ...folderIcon("folder_node_open"),
  ...folderIcon("folder_git"),
  ...folderIcon("folder_git_open"),
  ...folderIcon("folder_docs"),
  ...folderIcon("folder_docs_open"),
  ...folderIcon("folder_test"),
  ...folderIcon("folder_test_open"),
  ...icon("rust"),
  ...icon("python"),
  ...icon("js"),
  ...icon("typescript"),
  ...icon("react"),
  ...icon("json"),
  ...icon("html"),
  ...icon("css"),
  ...icon("markdown"),
  ...icon("docker"),
  ...icon("git"),
};

export default icons;
