const https = require('https');

/**
 * Escape string for Telegram HTML parse_mode.
 * Replaces & < > so that user content does not break the message.
 */
function escapeForTelegramHtml(str) {
  if (str == null || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Send a message to Telegram. Optional retries on failure.
 * @param {string} token - Bot token
 * @param {string} chatId - Chat or channel ID
 * @param {string} text - Message text (HTML)
 * @param {{ retries?: number }} options - retries: number of retries (default 2)
 * @returns {Promise<string>} - Response body on success
 */
function sendTelegram(token, chatId, text, options = {}) {
  const retries = options.retries != null ? options.retries : 2;
  let lastError;

  function doRequest() {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' });
      const req = https.request(
        {
          hostname: 'api.telegram.org',
          path: `/bot${token}/sendMessage`,
          method: 'POST',
          timeout: 8000,
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data),
          },
        },
        (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            if (res.statusCode === 200) resolve(body);
            else reject(new Error(`Telegram API ${res.statusCode}: ${body}`));
          });
        }
      );
      req.on('timeout', () => { req.destroy(new Error('Telegram request timeout')); });
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  return (async function attempt(attemptsLeft) {
    try {
      return await doRequest();
    } catch (err) {
      lastError = err;
      if (attemptsLeft > 0) {
        await new Promise((r) => setTimeout(r, 2000));
        return attempt(attemptsLeft - 1);
      }
      throw lastError;
    }
  })(retries);
}

module.exports = { escapeForTelegramHtml, sendTelegram };
