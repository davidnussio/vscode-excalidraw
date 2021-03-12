import React, { useEffect, useState, useRef } from "react";
import Excalidraw from "@excalidraw/excalidraw";

import "./styles.css";

class FileSystemFileHandleBridge {
  createWritable() {
    return this;
  }

  write() {}

  close() {
    window.parent.postMessage({ type: "save" }, "*");
  }
}

window.showSaveFilePicker = () => {
  return new FileSystemFileHandleBridge();
};

window.showOpenFilePicker = undefined;

const debounce = (func, wait) => {
  let timeout;

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };

    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export default function App() {
  const excalidrawRef = useRef(null);
  const [dimensions, setDimensions] = useState({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    setDimensions({
      width: document.body.getBoundingClientRect().width,
      height: document.body.getBoundingClientRect().height,
    });
    const onResize = () => {
      setDimensions({
        width: document.body.getBoundingClientRect().width,
        height: document.body.getBoundingClientRect().height,
      });
    };

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    window.addEventListener("message", (event) => {
      if (event.data.source === "vscode-excalidraw") {
        const data = JSON.parse(event.data.data);
        excalidrawRef.current.updateScene(data);
      }
    });
    window.parent.postMessage({ type: "init" }, "*");
  }, []);

  return (
    <div className="App">
      <Excalidraw
        ref={excalidrawRef}
        width={dimensions.width}
        height={dimensions.height}
        onChange={debounce((elements, state) => {
          window.parent.postMessage(
            {
              type: "autosave",
              data: {
                type: "excalidraw",
                version: 2,
                source: "https://excalidraw.com",
                elements,
                appState: {
                  gridSize: null,
                  viewBackgroundColor: "#ffffff",
                },
              },
            },
            "*"
          );
        }, 200)}
        // onPointerUpdate={(payload) => console.log(payload)}
        // onCollabButtonClick={() =>
        //   window.alert("You clicked on collab button")
        // }
        // viewModeEnabled={viewModeEnabled}
        // zenModeEnabled={zenModeEnabled}
        // gridModeEnabled={gridModeEnabled}
      />
    </div>
  );
}
