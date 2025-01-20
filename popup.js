document.addEventListener("DOMContentLoaded", () => {
    const pathFilterInput = document.getElementById("pathFilter");
    const setFilterButton = document.getElementById("setFilter");
    const logsContainer = document.getElementById("logs");

    // Load the current filter from storage
    chrome.storage.local.get("pathFilter", (data) => {
        pathFilterInput.value = data.pathFilter || "";
    });

    // Update the filter when the user clicks "Set Filter"
    setFilterButton.addEventListener("click", () => {
        const newFilter = pathFilterInput.value.trim();
        chrome.storage.local.set({ pathFilter: newFilter }, () => {
            console.log("Path filter updated to:", newFilter);
        });
    });

    // Listen for new log entries from the service worker
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === "NEW_LOG") {
            const log = message.logEntry;
            const logElement = document.createElement("div");
            logElement.className = "log";
            logElement.textContent = `
${log.timestamp} - ${log.method} ${log.path}
Query Params: ${JSON.stringify(log.queryParams, null, 2)}
      `;
            logsContainer.prepend(logElement);
        }
    });
});
