import React, { useEffect, useState, useRef } from "react";
import Excalidraw from "@excalidraw/excalidraw";

import "./styles.css";

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

  window.showSaveFilePicker = (event) => {
    console.log(excalidrawRef.current);
    console.log("super show shile pick", JSON.stringify(event));
    window.parent.postMessage({ type: "save" }, "*");
    return false;
  };

  window.showOpenFilePicker = () => {
    console.log("showOpenFilePicker");
    return false;
  };

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
