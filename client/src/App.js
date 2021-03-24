import Excalidraw from "@excalidraw/excalidraw";
import React, { useEffect, useRef, useState } from "react";
// import Library from "@excalidraw/excalidraw/";
import "./styles.css";

const logObject = (object) => console.log(JSON.stringify(object, null, 2));

window.confirm = () => true;

class FileSystemFileHandleVsCodeBridge {
  constructor(opts) {
    this.opts = opts;
    this.data = "";
  }

  createWritable() {
    return this;
  }

  write(data) {
    this.data = data;
  }

  close() {
    if (this.opts.types[0].accept["image/png"]) {
      const reader = new FileReader();
      reader.readAsDataURL(this.data);
      reader.onload = () => {
        window.parent.postMessage(
          {
            type: "save-dialog",
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
            type: "save-dialog",
            data: await this.data.text(),
            opts: this.opts,
          },
          "*"
        );
      })();
    }
  }
}

// class FileSystemHandleVsCodeBridge {
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
  return new FileSystemFileHandleVsCodeBridge(data);
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

  window.showOpenFilePicker = async (data) => {
    logObject(data);
    return new Promise((res, rej) => {
      // setTimeout(() => res([new FileSystemHandleVsCodeBridge()]), 1000);
      window.parent.postMessage({ type: "execute-command" }, "*");
      setTimeout(
        () =>
          rej(
            new Error(
              "It's not fully supported, after loading library you have to reopen the application"
            )
          ),
        300
      );
    });
  };

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
    const messageCallback = (event) => {
      if (event.data.source !== "vscode-excalidraw") {
        return;
      }
      if (event.data.type === "import:lib") {
        const library = JSON.parse(localStorage.getItem("excalidraw-library"));
        const data = JSON.parse(event.data.data);
        localStorage.setItem(
          "excalidraw-library",
          JSON.stringify(
            (Array.isArray(library) ? library : []).concat(data.library)
          )
        );
      } else {
        const data = JSON.parse(event.data.data);
        excalidrawRef.current.updateScene(data);
      }
    };

    window.addEventListener("message", messageCallback);

    window.parent.postMessage({ type: "init" }, "*");

    return () => window.removeEventListener("message", messageCallback);
  }, []);

  return (
    <div className="App">
      <Excalidraw
        ref={excalidrawRef}
        width={dimensions.width}
        height={dimensions.height}
        onChange={debounce((elements, state) => {
          if (!state) {
            return;
          }
          window.parent.postMessage(
            {
              type: "update-vscode-document",
              data: {
                type: "excalidraw",
                version: 2,
                source: "https://excalidraw.com",
                elements,
                appState: state,
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
