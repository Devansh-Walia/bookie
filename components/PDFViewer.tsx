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
      <View style={styles.closeContainer}>
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <Text style={styles.closeButtonText}>×</Text>
        </TouchableOpacity>
      </View>
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
                    background-color: #2C3E50;
                    font-family: -apple-system, BlinkMacSystemFont, system-ui;
                    touch-action: manipulation;
                    overflow: hidden;
                  }
                  #controls {
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    padding: 15px;
                    background-color: rgba(0, 0, 0, 0.8);
                    backdrop-filter: blur(10px);
                    -webkit-backdrop-filter: blur(10px);
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                    z-index: 100;
                  }
                  #controls button {
                    margin: 0 15px;
                    padding: 10px 20px;
                    background: linear-gradient(145deg, #3498db, #2980b9);
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-size: 16px;
                    font-weight: 500;
                    min-width: 120px;
                    touch-action: manipulation;
                    transition: transform 0.2s, background 0.3s;
                    cursor: pointer;
                  }
                  #controls button:active {
                    transform: scale(0.95);
                    background: linear-gradient(145deg, #2980b9, #3498db);
                  }
                  #pageInfo {
                    color: white;
                    margin: 0 10px;
                    min-width: 100px;
                    text-align: center;
                    font-size: 16px;
                    font-weight: 500;
                  }
                  #viewer {
                    flex: 1;
                    overflow: hidden;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    position: relative;
                    perspective: 1000px;
                    transform-style: preserve-3d;
                    background: #1a2634;
                  }
                  #pageContainer {
                    position: relative;
                    width: 100%;
                    height: 100%;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    transform-style: preserve-3d;
                    transition: transform 0.8s cubic-bezier(0.5, 0, 0.2, 1);
                  }
                  canvas {
                    margin: 10px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
                    max-width: calc(100% - 20px);
                    height: auto !important;
                    border-radius: 10px;
                  }
                  #pageContainer.flipping-right {
                    transform-origin: left center;
                    animation: flipRight 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                  }
                  #pageContainer.flipping-left {
                    transform-origin: left center;
                    animation: flipLeft 0.8s cubic-bezier(0.4, 0, 0.2, 1);
                  }
                  @keyframes flipRight {
                    0% { 
                      transform: rotateY(0deg) translateZ(0);
                      box-shadow: -5px 0 25px rgba(0,0,0,0.1);
                    }
                    50% {
                      transform: rotateY(-90deg) translateZ(100px);
                      box-shadow: -15px 0 35px rgba(0,0,0,0.2);
                    }
                    100% { 
                      transform: rotateY(-180deg) translateZ(0);
                      box-shadow: -5px 0 25px rgba(0,0,0,0.1);
                    }
                  }
                  @keyframes flipLeft {
                    0% { 
                      transform: rotateY(-90deg) translateZ(100px);
                      box-shadow: 5px 0 25px rgba(0,0,0,0.1);
                    }
                    100% { 
                      transform: rotateY(0deg) translateZ(0);
                      box-shadow: 5px 0 25px rgba(0,0,0,0.1);
                    }
                  }
                </style>
              </head>
              <body>
                <div id="controls">
                  <button id="prev">Previous</button>
                  <span id="pageInfo">Page: ${currentPage}</span>
                  <button id="next">Next</button>
                </div>
                <div id="viewer">
                  <div id="pageContainer"></div>
                </div>
                <script>
                  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
                  
                  let currentPage = ${currentPage};
                  let pdfDoc = null;
                  let currentScale = 1.5;
                  let isAnimating = false;
                  const viewer = document.getElementById('viewer');
                  const pageInfo = document.getElementById('pageInfo');
                  
                  const renderPage = async (num, scale = currentScale) => {
                    const page = await pdfDoc.getPage(num);
                    const viewport = page.getViewport({ scale });
                    
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    
                    const pageContainer = document.getElementById('pageContainer');
                    pageContainer.innerHTML = '';
                    pageContainer.appendChild(canvas);
                    
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
                        if (currentPage <= 1 || isAnimating) return;
                        currentPage--;
                        renderPage(currentPage);
                      };
                      
                      document.getElementById('next').onclick = () => {
                        if (currentPage >= pdfDoc.numPages || isAnimating) return;
                        currentPage++;
                        renderPage(currentPage);
                      };

                      // Add touch swipe handling
                      let touchStartX = 0;
                      let touchStartY = 0;
                      let touchStartTime = 0;
                      
                      viewer.addEventListener('touchstart', (e) => {
                        if (isAnimating) return;
                        touchStartTime = Date.now();
                        touchStartY = e.touches[0].clientY;
                        touchStartX = e.touches[0].clientX;
                      });
                      
                      viewer.addEventListener('touchend', (e) => {
                        if (isAnimating) return;
                        const touchEndX = e.changedTouches[0].clientX;
                        const touchEndY = e.changedTouches[0].clientY;
                        const touchEndTime = Date.now();
                        
                        const diffX = touchStartX - touchEndX;
                        const diffY = Math.abs(touchStartY - touchEndY);
                        const timeDiff = touchEndTime - touchStartTime;
                        
                        // Check if the swipe is more horizontal than vertical
                        if (Math.abs(diffX) > diffY && Math.abs(diffX) > 50 && timeDiff < 300) {
                          const pageContainer = document.getElementById('pageContainer');
                          
                          if (diffX > 0 && currentPage < pdfDoc.numPages) {
                            isAnimating = true;
                            pageContainer.className = 'flipping-right';
                            setTimeout(() => {
                              currentPage++;
                              renderPage(currentPage);
                              pageContainer.className = '';
                              isAnimating = false;
                            }, 400);
                          } else if (diffX < 0 && currentPage > 1) {
                            isAnimating = true;
                            pageContainer.className = 'flipping-left';
                            setTimeout(() => {
                              currentPage--;
                              renderPage(currentPage);
                              pageContainer.className = '';
                              isAnimating = false;
                            }, 400);
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
  closeContainer: {
    position: "absolute",
    top: 90,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  closeButton: {
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
