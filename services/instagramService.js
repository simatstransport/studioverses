const axios = require('axios');
const config = require('../config');

class InstagramService {
  constructor() {
    this.graphApiVersion = 'v21.0';
    this.baseUrl = `https://graph.facebook.com/${this.graphApiVersion}`;
  }

  getCredentials() {
    return {
      accountId: config.instagramAccountId,
      accessToken: config.instagramAccessToken,
      publicBaseUrl: config.publicBaseUrl
    };
  }

  isConfigured() {
    return Boolean(config.instagramAccountId && config.instagramAccessToken);
  }

  /**
   * Publishes an image to Instagram Feed via Instagram Graph API
   * @param {Object} options
   * @param {string} options.imageUrl - Public URL to the 1080x1350 image
   * @param {string} options.caption - Caption with verse text and hashtags
   * @returns {Promise<Object>}
   */
  async publishPhoto({ imageUrl, caption }) {
    const { accountId, accessToken, publicBaseUrl } = this.getCredentials();

    if (!accountId || !accessToken) {
      throw new Error(
        'Instagram credentials missing. Please set INSTAGRAM_ACCOUNT_ID and INSTAGRAM_ACCESS_TOKEN in your .env file.'
      );
    }

    // Resolve absolute public URL if relative
    let finalImageUrl = imageUrl;
    if (imageUrl.startsWith('/')) {
      finalImageUrl = `${publicBaseUrl}${imageUrl}`;
    }

    // Verify it is an HTTPS public URL
    if (finalImageUrl.includes('localhost') || finalImageUrl.includes('127.0.0.1')) {
      throw new Error(
        `Instagram Graph API requires a public HTTPS image URL. Your current URL is "${finalImageUrl}". ` +
        `To test locally, start an ngrok tunnel (e.g., "ngrok http 3000") and set PUBLIC_BASE_URL=https://your-tunnel.ngrok-free.app in your .env.`
      );
    }

    console.log(`[InstagramService] Creating media container for ${finalImageUrl}...`);

    try {
      // Step 1: Create Media Container
      const createResponse = await axios.post(
        `${this.baseUrl}/${accountId}/media`,
        null,
        {
          params: {
            image_url: finalImageUrl,
            caption: caption,
            access_token: accessToken
          },
          timeout: 25000
        }
      );

      const creationId = createResponse.data?.id;
      if (!creationId) {
        throw new Error('Failed to create media container: No container ID returned.');
      }

      console.log(`[InstagramService] Container created (ID: ${creationId}). Waiting for processing...`);

      // Step 2: Poll container status until FINISHED
      await this._waitForContainerReady(creationId, accessToken);

      // Step 3: Publish Media Container
      console.log(`[InstagramService] Publishing container ${creationId} to Instagram feed...`);
      const publishResponse = await axios.post(
        `${this.baseUrl}/${accountId}/media_publish`,
        null,
        {
          params: {
            creation_id: creationId,
            access_token: accessToken
          },
          timeout: 25000
        }
      );

      const publishedMediaId = publishResponse.data?.id;
      console.log(`[InstagramService] Successfully published to Instagram! Media ID: ${publishedMediaId}`);

      return {
        success: true,
        mediaId: publishedMediaId,
        permalink: `https://www.instagram.com/p/${publishedMediaId}`,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      const fbError = err.response?.data?.error;
      const errorMsg = fbError ? `${fbError.message} (code: ${fbError.code}, type: ${fbError.type})` : err.message;
      console.error('[InstagramService] Publish failed:', errorMsg);
      throw new Error(`Instagram Graph API Error: ${errorMsg}`);
    }
  }

  /**
   * Polls the container status every 2 seconds until status_code === 'FINISHED'
   */
  async _waitForContainerReady(creationId, accessToken, maxAttempts = 15) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await axios.get(`${this.baseUrl}/${creationId}`, {
          params: {
            fields: 'status_code,status',
            access_token: accessToken
          },
          timeout: 10000
        });

        const status = res.data?.status_code;
        console.log(`[InstagramService] Container status (attempt ${attempt}): ${status}`);

        if (status === 'FINISHED') {
          return true;
        }

        if (status === 'ERROR' || status === 'EXPIRED') {
          throw new Error(`Media container processing failed with status: ${status}`);
        }
      } catch (err) {
        if (attempt === maxAttempts) throw err;
      }

      // Wait 2 seconds before checking again
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    throw new Error('Timed out waiting for Instagram media container to finish processing.');
  }

  /**
   * Verifies the Instagram token & account ID
   */
  async testConnection() {
    const { accountId, accessToken } = this.getCredentials();
    if (!accountId || !accessToken) {
      return { connected: false, error: 'Credentials not configured in .env' };
    }

    try {
      const res = await axios.get(`${this.baseUrl}/${accountId}`, {
        params: {
          fields: 'id,username,name,profile_picture_url',
          access_token: accessToken
        },
        timeout: 10000
      });

      return {
        connected: true,
        account: res.data
      };
    } catch (err) {
      const fbError = err.response?.data?.error;
      return {
        connected: false,
        error: fbError ? fbError.message : err.message
      };
    }
  }
}

module.exports = new InstagramService();
