const model = '01-ai/Yi-1.5-34B-Chat'; // Replace with your model name
const apiKey = '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'; // Replace with your Hugging Face API key

const chatBox = document.getElementById('chatBox');
const messageInput = document.getElementById('messageInput');
const sendMessageButton = document.getElementById('sendMessage');

let chatHistory = [];
chatHistory.push({ role: 'system', content: `From now on, you'll act as an AI assistant, named SW4P and you were developed by the BubbleTeam. You will respond to prompts clearly, short and simply.
You’ll provide responses in this straightforward and helpful manner. You are smart.`});

// Set up the button symbols
const sendSymbol = '➤';   // Envelope symbol for Send
const cancelSymbol = '■'; // Cross mark symbol for Cancel
const regenSymbol = '↻';  // Symbol for Regenerate (or choose another appropriate symbol)

// Set the initial button text to the send symbol
sendMessageButton.textContent = sendSymbol;

sendMessageButton.addEventListener('click', async () => {
    const userMessage = messageInput.value.trim();
    if (userMessage) {
        addMessage('user', userMessage); // Display the user's message immediately
        chatHistory.push({ role: 'user', content: userMessage });
        messageInput.value = '';

        // Create a new AbortController to handle canceling the request
        const controller = new AbortController();
        const { signal } = controller;

        // Delay the display of the loading animation
        let loadingElement;
        const loadingPromise = new Promise((resolve) => {
            setTimeout(() => {
                loadingElement = addMessage('bot', 'Loading...', false, true);
                resolve();
            }, 0);
        });

        // Initialize a variable to hold the bot's partial message
        let botMessage = '';

        // Change Send button to Cancel button with symbol
        sendMessageButton.textContent = cancelSymbol;
        sendMessageButton.onclick = () => {
            controller.abort(); // Cancel the request
            if (loadingElement) {
                chatBox.removeChild(loadingElement); // Remove loading element
            }
            if (botMessage) {
                // Add the partially received bot message to chat history
                chatHistory.push({ role: 'assistant', content: botMessage });
            }
            sendMessageButton.textContent = sendSymbol;
            sendMessageButton.onclick = null; // Reset to default click behavior
        };

        try {
            await loadingPromise; // Ensure loading element is shown before proceeding

            const seed = Math.floor(Math.random() * 1000000);
            const response = await fetch(`https://api-inference.huggingface.co/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: chatHistory,
                    max_tokens: 2500,
                    seed: seed,
                    stream: true // Enable streaming
                }),
                signal // Pass the signal to the fetch request
            });

            if (!response.ok) {
                throw new Error(`API Error: ${response.statusText}`);
            }

            // Handle streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            // Create a bot message element to update
            const botMessageElement = addMessage('bot', '', true);

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim());

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const json = line.slice(6); // Remove the "data: " prefix
                        try {
                            const parsed = JSON.parse(json);
                            if (parsed.choices && parsed.choices[0].delta) {
                                botMessage += parsed.choices[0].delta.content || '';
                                // Update the existing bot message element with the accumulated message
                                botMessageElement.textContent = botMessage;
                            }
                        } catch (e) {
                            console.error('Error parsing JSON:', e);
                        }
                    }
                }
            }

            // Remove loading animation once the streaming is done
            if (loadingElement) {
                chatBox.removeChild(loadingElement);
            }

            // Add the complete bot message to chat history
            chatHistory.push({ role: 'assistant', content: botMessage });

        } catch (error) {
            if (error.name !== 'AbortError') { // Handle only non-abort errors
                console.error('Error fetching bot response:', error);
                if (loadingElement) {
                    chatBox.removeChild(loadingElement);
                }

                // Change Send button to Regenerate button with symbol
                sendMessageButton.textContent = regenSymbol;
                sendMessageButton.onclick = () => {
                    // Reset the input field to the previous user message
                    messageInput.value = userMessage;
                    sendMessageButton.click(); // Retry the send action
                };
            }
        } finally {
            if (sendMessageButton.textContent !== regenSymbol) {
                // Reset the button to "Send" after completion or cancellation
                sendMessageButton.textContent = sendSymbol;
                sendMessageButton.onclick = null; // Reset to default click behavior
            }
        }
    }
});

function addMessage(sender, content, wordByWord = false, isLoading = false) {
    const messageElement = document.createElement('div');
    messageElement.classList.add('message', sender);

    if (isLoading) {
        messageElement.classList.add('loading');
        for (let i = 0; i < 3; i++) {
            const dot = document.createElement('div');
            dot.classList.add('dot');
            messageElement.appendChild(dot);
        }
    } else {
        if (wordByWord && sender === 'bot') {
            displayMessageWordByWord(messageElement, content);
        } else {
            messageElement.innerHTML = content;
        }
    }

    chatBox.appendChild(messageElement);
    chatBox.scrollTop = chatBox.scrollHeight;
    return messageElement; // Return the element for further manipulation
}

function displayMessageWordByWord(element, message) {
    const words = message.split(' ');
    let currentWordIndex = 0;

    function addNextWord() {
        if (currentWordIndex < words.length) {
            element.innerHTML += words[currentWordIndex] + ' ';
            currentWordIndex++;
            setTimeout(addNextWord, 10); // Adjust delay here for word-by-word effect
        }
    }

    addNextWord();
}

function formatContent(content) {
    return content
        .replace(/\n/g, '<br>')   // Replace new lines with <br> tags
        .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;'); // Replace tabs with four non-breaking spaces
}

// Handle pressing Enter and Tab keys in the input box
messageInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessageButton.click();
    }

    // Handle Tab key for inserting a tab character
    if (e.key === 'Tab') {
        e.preventDefault();
        const start = this.selectionStart;
        const end = this.selectionEnd;

        // Insert tab character
        this.value = this.value.substring(0, start) + '\t' + this.value.substring(end);

        // Move the caret to after the tab
        this.selectionStart = this.selectionEnd = start + 1;
    }
});

// Function to send a hidden prompt to the AI
async function sendHiddenPrompt(hiddenMessage) {
    // Add the hidden message to the chat history without displaying it
    chatHistory.push({ role: 'user', content: hiddenMessage });

    // Create a new AbortController to handle canceling the request if needed
    const controller = new AbortController();
    const { signal } = controller;

    // Delay the display of the loading animation
    let loadingElement;
    const loadingPromise = new Promise((resolve) => {
        setTimeout(() => {
            loadingElement = addMessage('bot', 'Loading...', false, true);
            resolve();
        }, 0);
    });

    // Initialize a variable to hold the bot's partial message
    let botMessage = '';

    try {
        await loadingPromise; // Ensure loading element is shown before proceeding

        const seed = Math.floor(Math.random() * 1000000);
        const response = await fetch(`https://api-inference.huggingface.co/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: model,
                messages: chatHistory,
                max_tokens: 2500,
                seed: seed,
                stream: true // Enable streaming
            }),
            signal // Pass the signal to the fetch request
        });

        if (!response.ok) {
            throw new Error(`API Error: ${response.statusText}`);
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        // Create a bot message element to update
        const botMessageElement = addMessage('bot', '', true);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim());

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const json = line.slice(6); // Remove the "data: " prefix
                    try {
                        const parsed = JSON.parse(json);
                        if (parsed.choices && parsed.choices[0].delta) {
                            botMessage += parsed.choices[0].delta.content || '';
                            // Update the existing bot message element with the accumulated message
                            botMessageElement.textContent = botMessage;
                        }
                    } catch (e) {
                        console.error('Error parsing JSON:', e);
                    }
                }
            }
        }

        // Remove loading animation once the streaming is done
        if (loadingElement) {
            chatBox.removeChild(loadingElement);
        }

        // Add the complete bot message to chat history
        chatHistory.push({ role: 'assistant', content: botMessage });

    } catch (error) {
        if (error.name !== 'AbortError') { // Handle only non-abort errors
            console.error('Error fetching bot response:', error);
            if (loadingElement) {
                chatBox.removeChild(loadingElement);
            }
            addMessage('bot', "Sorry, something went wrong. Please try again.", true);
        }
    }
}

// Example: Sending a hidden "Start" message to the AI
sendHiddenPrompt(`Hello! Please introduce yourself in like 30-38 words and in English.`); // You can customize this message
