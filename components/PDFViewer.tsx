import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
  SafeAreaView,
} from "react-native";
import { WebView } from "react-native-webview";
import * as FileSystem from "expo-file-system";
import useBookStore from "../store/bookStore";

interface PDFViewerProps {
  bookId: string;
  fileUri: string;
  currentPage: number;
  onClose: () => void;
}

export default function PDFViewer({
  bookId,
  fileUri,
  currentPage,
  onClose,
}: PDFViewerProps) {
  const { updatePage } = useBookStore();
  const [base64Content, setBase64Content] = useState<string | null>(null);

  useEffect(() => {
    const loadPDF = async () => {
      try {
        const base64 = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        setBase64Content(base64);
      } catch (error) {
        console.error("Error loading PDF:", error);
      }
    };

    loadPDF();
  }, [fileUri]);

  if (!base64Content) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.loadingText}>Loading PDF...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>×</Text>
      </TouchableOpacity>
      <WebView
        style={styles.webview}
        source={{
          html: `
            <!DOCTYPE html>
            <html>
              <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=2.0, user-scalable=yes">
                <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
                <style>
                  body, html {
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    display: flex;
                    flex-direction: column;
                    background-color: #525659;
                    font-family: system-ui;
                    touch-action: manipulation;
                  }
                  #controls {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 10px;
                    background-color: #333;
                  }
                  #controls button {
                    margin: 0 10px;
                    padding: 8px 16px;
                    background: #666;
                    border: none;
                    border-radius: 4px;
                    color: white;
                    font-size: 16px;
                    min-width: 100px;
                    touch-action: manipulation;
                  }
                  #controls button:active {
                    background: #777;
                  }
                  #pageInfo {
                    color: white;
                    margin: 0 20px;
                    min-width: 80px;
                    text-align: center;
                  }
                  #viewer {
                    flex: 1;
                    overflow: auto;
                    display: flex;
                    justify-content: center;
                    align-items: flex-start;
                    -webkit-overflow-scrolling: touch;
                  }
                  canvas {
                    margin: 10px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                    max-width: 100%;
                    height: auto !important;
                  }
                </style>
              </head>
              <body>
                <div id="controls">
                  <button id="prev">Previous</button>
                  <span id="pageInfo">Page: ${currentPage}</span>
                  <button id="next">Next</button>
                </div>
                <div id="viewer"></div>
                <script>
                  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                  
                  let currentPage = ${currentPage};
                  let pdfDoc = null;
                  let currentScale = 1.5;
                  const viewer = document.getElementById('viewer');
                  const pageInfo = document.getElementById('pageInfo');
                  
                  const renderPage = async (num, scale = currentScale) => {
                    const page = await pdfDoc.getPage(num);
                    const viewport = page.getViewport({ scale });
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    
                    viewer.innerHTML = '';
                    viewer.appendChild(canvas);
                    
                    await page.render({
                      canvasContext: context,
                      viewport: viewport
                    }).promise;
                    
                    pageInfo.textContent = 'Page: ' + num;
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'pageChange', page: num }));
                  };
                  
                  const loadPDF = async () => {
                    try {
                      pdfDoc = await pdfjsLib.getDocument({data: atob('${base64Content}')}).promise;
                      
                      document.getElementById('prev').onclick = () => {
                        if (currentPage <= 1) return;
                        currentPage--;
                        renderPage(currentPage);
                      };
                      
                      document.getElementById('next').onclick = () => {
                        if (currentPage >= pdfDoc.numPages) return;
                        currentPage++;
                        renderPage(currentPage);
                      };

                      // Add touch swipe handling
                      let touchStartX = 0;
                      viewer.addEventListener('touchstart', (e) => {
                        touchStartX = e.touches[0].clientX;
                      });
                      
                      viewer.addEventListener('touchend', (e) => {
                        const touchEndX = e.changedTouches[0].clientX;
                        const diff = touchStartX - touchEndX;
                        
                        if (Math.abs(diff) > 50) { // Minimum swipe distance
                          if (diff > 0 && currentPage < pdfDoc.numPages) {
                            currentPage++;
                            renderPage(currentPage);
                          } else if (diff < 0 && currentPage > 1) {
                            currentPage--;
                            renderPage(currentPage);
                          }
                        }
                      });
                      
                      renderPage(currentPage);
                    } catch (err) {
                      console.error('Error loading PDF:', err);
                    }
                  };
                  
                  loadPDF();
                </script>
              </body>
            </html>
          `,
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        onMessage={(event) => {
          try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === "pageChange") {
              updatePage(bookId, data.page);
            }
          } catch (error) {
            console.error("Error parsing message:", error);
          }
        }}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.warn("WebView error: ", nativeEvent);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 20,
  },
  container: {
    flex: 1,
    backgroundColor: "white",
  },
  webview: {
    flex: 1,
  },
  closeButton: {
    position: "absolute",
    top: 10,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  closeButtonText: {
    color: "white",
    fontSize: 24,
    fontWeight: "600",
  },
});
