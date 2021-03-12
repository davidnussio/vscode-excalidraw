import React, { useEffect, useState, useRef } from "react";
import Excalidraw from "@excalidraw/excalidraw";
import "./styles.css";

class FileSystemFileHandleBridge {
  constructor(opts) {
    this.opts = opts;
    this.data = "";
  }

  createWritable() {
    return this;
  }

  async write(data) {
    this.data = data;
  }

  close() {
    console.log("# close and send data", JSON.stringify(this.opts));

    if (this.opts.types[0].accept["image/png"]) {
      const reader = new FileReader();
      reader.readAsDataURL(this.data);
      reader.onload = () => {
        window.parent.postMessage(
          {
            type: "save",
            data: reader.result,
            opts: this.opts,
          },
          "*"
        );
      };
    } else if (
      this.opts.types[0].accept["application/vnd.excalidrawlib+json"] ||
      this.opts.types[0].accept["image/svg+xml"]
    ) {
      (async () => {
        window.parent.postMessage(
          {
            type: "save",
            data: await this.data.text(),
            opts: this.opts,
          },
          "*"
        );
      })();
    }
  }
}

// class FileSystemHandleBridge {
//   constructor(data) {
//     this.type = "file";
//   }

//   createWritable(data) {
//     return this;
//   }

//   getFile() {
//     return new File(["data"], "foo.txt", {
//       type: "text/plain",
//     });
//   }
// }

window.showSaveFilePicker = (data) => {
  return new FileSystemFileHandleBridge(data);
};

window.showOpenFilePicker = async () => {
  return new Promise((res, rej) => {
    // setTimeout(() => res([new FileSystemHandleBridge()]), 1000);
    rej(new Error("Open file not Implemented"));
  });
};

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
