console.log("[Content Script] Starting...");

// Set up message listener BEFORE injecting the script
window.addEventListener('message', function(event) {
    console.log('[Content Script] Message received:', event.data);
    
    if (event.source !== window) {
        console.log('[Content Script] Ignoring message from different source');
        return;
    }
    
    if (event.data.type !== '__NETWORK_INTERCEPT__') {
        console.log('[Content Script] Ignoring non-intercept message');
        return;
    }

    console.log('[Content Script] Processing intercepted message:', event.data);

    try {
        const data = event.data.data;
        
        // Test if we're getting the data we expect
        if (!data || !data.response) {
            console.error('[Content Script] Invalid data structure:', data);
            return;
        }

        console.log('[Content Script] Sending to service worker:', {
            url: data.url,
            bodySize: data.response.body ? JSON.stringify(data.response.body).length : 0,
            status: data.response.status,
            statusText: data.response.statusText
        });

        // Send to service worker with explicit response
        chrome.runtime.sendMessage({
            type: 'RESPONSE_BODY',
            url: data.url,
            body: data.response.body,
            status: data.response.status,
            statusText: data.response.statusText
        }, (response) => {
            console.log('[Content Script] Service worker response:', response);
        }).catch(error => {
            console.error('[Content Script] Error sending to service worker:', error);
        });
    } catch (error) {
        console.error('[Content Script] Error processing intercepted message:', error);
    }
});

console.log("[Content Script] Message listener set up");

// This code will be injected into the page
const interceptorCode = `
// Wrap in IIFE to avoid polluting global scope
(function() {
    console.log('[Interceptor] Starting installation...');

    // Store original methods
    const originalXHR = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;
    const originalFetch = window.fetch;

    // Function to send data to extension
    function sendToExtension(type, data) {
        console.log('[Interceptor] Sending message:', data);
        window.postMessage({
            type: '__NETWORK_INTERCEPT__',
            interceptType: type,
            data: data
        }, '*');
    }

    // Patch XMLHttpRequest
    XMLHttpRequest.prototype.open = function(method, url) {
        this._interceptData = { method, url };
        return originalXHR.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(data) {
        const xhr = this;
        
        xhr.addEventListener('loadend', function() {
            try {
                console.log('[Interceptor] XHR completed:', xhr._interceptData?.url);
                let responseBody;
                
                try {
                    responseBody = JSON.parse(xhr.responseText);
                } catch (e) {
                    responseBody = xhr.responseText;
                }

                sendToExtension('xhr', {
                    url: xhr._interceptData?.url,
                    method: xhr._interceptData?.method,
                    response: {
                        status: xhr.status,
                        statusText: xhr.statusText,
                        body: responseBody
                    }
                });
            } catch (error) {
                console.error('[Interceptor] XHR intercept error:', error);
            }
        });
        
        return originalSend.apply(this, arguments);
    };

    // Patch fetch
    window.fetch = async function(...args) {
        const request = args[0];
        let method, url;

        if (request instanceof Request) {
            method = request.method;
            url = request.url;
        } else {
            url = request;
            method = (args[1]?.method || 'GET');
        }

        try {
            const response = await originalFetch.apply(this, args);
            const responseClone = response.clone();
            
            let responseBody;
            try {
                responseBody = await responseClone.json();
            } catch (e) {
                try {
                    responseBody = await responseClone.text();
                } catch (err) {
                    console.error('[Interceptor] Could not get response body');
                }
            }

            sendToExtension('fetch', {
                url,
                method,
                response: {
                    status: response.status,
                    statusText: response.statusText,
                    body: responseBody
                }
            });

            return response;
        } catch (error) {
            console.error('[Interceptor] Fetch intercept error:', error);
            throw error;
        }
    };

    console.log('[Interceptor] Network interception installed');
})();
`;

// Create and inject the script
const script = document.createElement('script');
script.textContent = interceptorCode;
console.log('[Content Script] Injecting interceptor code');

// Inject at the earliest possible moment
const target = document.documentElement || document.head || document.body;
target.insertBefore(script, target.firstChild);
script.remove();

console.log('[Content Script] Setup complete');