console.log("Service worker initialized");

let pathFilter = "";
let methodFilter = "";
let windowId = null;

// Load stored filters when service worker starts
chrome.storage.local.get(["pathFilter", "methodFilter"], (data) => {
    pathFilter = data.pathFilter || "";
    methodFilter = data.methodFilter || "";
    console.log("Loaded stored filters - Path:", pathFilter, "Method:", methodFilter);
});

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
        if (changes.pathFilter?.newValue !== undefined) {
            pathFilter = changes.pathFilter.newValue;
            console.log("Updated path filter:", pathFilter);
        }
        if (changes.methodFilter?.newValue !== undefined) {
            methodFilter = changes.methodFilter.newValue;
            console.log("Updated method filter:", methodFilter);
        }
    }
});

// Handle window creation
function openLoggerWindow() {
    if (windowId !== null) {
        chrome.windows.update(windowId, { focused: true });
        return;
    }

    chrome.windows.create({
        url: 'popup.html',
        type: 'popup',
        width: 800,
        height: 600
    }, (window) => {
        windowId = window.id;
    });
}

// Listen for window close to reset windowId
chrome.windows.onRemoved.addListener((removedWindowId) => {
    if (removedWindowId === windowId) {
        windowId = null;
    }
});

// Listen for extension icon click
chrome.action.onClicked.addListener(() => {
    openLoggerWindow();
});

// Store request details temporarily
const pendingResponses = new Map();

// Listen for requests
chrome.webRequest.onBeforeRequest.addListener(
    (details) => {
        const url = new URL(details.url);
        const path = url.pathname;
        const method = details.method;

        console.log('Request intercepted:', {
            path,
            method,
            url: details.url
        });

        // Store request details with both full URL and pathname
        pendingResponses.set(details.url, {
            request: {
                method,
                path,
                url: details.url,
                queryParams: Object.fromEntries(url.searchParams),
                timestamp: new Date().toISOString()
            },
            response: null
        });

        // Set cleanup timeout
        setTimeout(() => {
            pendingResponses.delete(details.url);
        }, 30000); // 30 second timeout
    },
    { urls: ["https://coopcrmprod.crm4.dynamics.com/*"] }
);

// Listen for response bodies from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Service worker received message:', message);

    if (message.type === "RESPONSE_BODY") {
        const pendingResponse = pendingResponses.get(message.url);
        
        console.log('Found pending response:', {
            url: message.url,
            pendingResponse: pendingResponse,
            allPendingUrls: Array.from(pendingResponses.keys())
        });

        if (!pendingResponse) return;

        // Create response object if it doesn't exist
        if (!pendingResponse.response) {
            pendingResponse.response = {
                timestamp: new Date().toISOString()
            };
        }

        // Add body to response
        pendingResponse.response.body = message.body;

        // Apply filters
        const normalizedPath = pendingResponse.request.path.toLowerCase();
        const normalizedFilter = pathFilter.toLowerCase();
        
        const pathMatches = !pathFilter || normalizedPath.includes(normalizedFilter);
        const methodMatches = !methodFilter || pendingResponse.request.method === methodFilter;

        console.log('Filter results:', {
            normalizedPath,
            normalizedFilter,
            pathMatches,
            methodMatches,
            willShow: pathMatches && methodMatches
        });

        if (pathMatches && methodMatches) {
            console.log('Sending log to popup:', pendingResponse);
            // Forward complete log to popup
            chrome.runtime.sendMessage({
                type: "NEW_LOG",
                logEntry: pendingResponse
            }).catch(error => {
                if (!error.message.includes("Receiving end does not exist")) {
                    console.error("Error forwarding to popup:", error);
                }
            });
        }

        // Clean up
        pendingResponses.delete(message.url);
    }
    sendResponse({ received: true });
});
