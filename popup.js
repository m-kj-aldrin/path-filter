document.addEventListener("DOMContentLoaded", () => {
    console.log("Popup initialized");
    
    const pathFilterInput = document.getElementById("pathFilter");
    const methodFilterSelect = document.getElementById("methodFilter");
    const setFilterButton = document.getElementById("setFilter");
    const logsContainer = document.getElementById("logs");

    // Load the current filters from storage
    chrome.storage.local.get(["pathFilter", "methodFilter"], (data) => {
        pathFilterInput.value = data.pathFilter || "";
        methodFilterSelect.value = data.methodFilter || "";
    });

    // Update the filters when the user clicks "Set Filters"
    setFilterButton.addEventListener("click", () => {
        const newPathFilter = pathFilterInput.value.trim();
        const newMethodFilter = methodFilterSelect.value;
        
        chrome.storage.local.set({ 
            pathFilter: newPathFilter,
            methodFilter: newMethodFilter 
        }, () => {
            console.log("Filters updated - Path:", newPathFilter, "Method:", newMethodFilter);
        });
    });

    // Listen for new log entries
    chrome.runtime.onMessage.addListener((message) => {
        console.log("Popup received message:", message);
        
        if (message.type === "NEW_LOG") {
            console.log("Creating log entry for:", message.logEntry);
            const log = message.logEntry;
            const logElement = document.createElement("div");
            logElement.className = "log";
            
            // Format request
            let logText = '=== REQUEST ===\n';
            logText += `${log.request.timestamp}\n`;
            logText += `${log.request.method} ${log.request.path}\n`;
            logText += `Query Params: ${JSON.stringify(log.request.queryParams, null, 2)}`;
            
            // Add request body if present
            if (log.request.requestBody) {
                logText += '\nRequest Body:';
                if (log.request.requestBody.type === 'batch') {
                    logText += '\n[Batch Request]';
                    log.request.requestBody.requests.forEach((req, index) => {
                        logText += `\n\nRequest ${index + 1}:`;
                        logText += `\n${req.request}`;
                        if (req.headers) {
                            logText += '\nHeaders:';
                            logText += `\n${req.headers.join('\n')}`;
                        }
                    });
                } else if (log.request.requestBody.type === 'text') {
                    logText += `\n[Plain Text]\n${log.request.requestBody.content}`;
                } else if (log.request.requestBody.type === 'form') {
                    logText += `\n[Form Data]\n${JSON.stringify(log.request.requestBody.content, null, 2)}`;
                } else {
                    logText += `\n${JSON.stringify(log.request.requestBody, null, 2)}`;
                }
            }

            // Format response
            logText += '\n\n=== RESPONSE ===\n';
            logText += `${log.response.timestamp}\n`;
            logText += `Status: ${log.response.status} ${log.response.statusText}\n`;
            if (log.response.body) {
                logText += `Body: ${JSON.stringify(log.response.body, null, 2)}`;
            }
            
            logElement.textContent = logText;
            logsContainer.prepend(logElement);
        }
    });
});
