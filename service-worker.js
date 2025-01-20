console.log("hello service worker");

let pathFilter = "";

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes.pathFilter?.newValue !== undefined) {
        pathFilter = changes.pathFilter.newValue;
        console.log("Updated path filter:", pathFilter);
    }
});

chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        const url = new URL(details.url);
        const method = details.method;
        const path = url.pathname;

        // Check if the path matches the filter
        if (!pathFilter || path.includes(pathFilter)) {
            // Extract query parameters
            const queryParams = {};
            for (const [key, value] of url.searchParams.entries()) {
                queryParams[key] = value;
            }

            // Log the details
            const logEntry = {
                method,
                path,
                queryParams,
                timestamp: new Date().toISOString(),
            };

            console.log("Log Entry:", logEntry);

            // Send the log entry to the UI
            chrome.runtime.sendMessage({ type: "NEW_LOG", logEntry });
        }
    },
    { urls: ["https://coopcrmprod.crm4.dynamics.com/*"] },
    ["requestBody"]
);
