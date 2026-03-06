// NLB Catalogue Search API Module
const https = require('https');
const crypto = require('crypto');

class CatalogueSearchAPI {
  constructor() {
    this.apiToken = process.env.NLB_CATALOGUE_API_TOKEN || '';
    this.tenantId = '3000086253';
    this.branch = 'BIPL'; // Bishan Public Library
    this.apiUrl = 'https://rec-api-sg1.recplusapi.com/sg2/ContentSaaS/Predict';
  }

  /**
   * Search NLB catalogue for books, magazines, DVDs, CDs, or eBooks
   */
  async searchCatalogue(query, options = {}) {
    const {
      size = 3,
      contentType = 'Book',
      language = 'English'
    } = options;

    const body = {
      project_id: 'nlb',
      model_id: 'econcierge_search',
      user_id: '0',
      size: size.toString(),
      scene: { page_number: '1' },
      extra: {
        query: query,
        search_fields: 'goods_title goods_author_id goods_cate',
        enable_language_filter: 'true',
        language: language,
        enable_content_type_filter: 'true',
        content_type: contentType,
        enable_branch_filter: 'true',
        branch: this.branch,
        enable_new_publish_day_filter: 'false',
        new_publish_day: '365',
        enable_audience_filter: 'false',
        enable_cate_filter: 'false',
        sort_mode: 'relevance_asc'
      }
    };

    const tenantTs = Math.floor(Date.now() / 1000).toString();
    const tenantNonce = tenantTs;
    const httpBody = JSON.stringify(body);
    const message = this.apiToken + httpBody + this.tenantId + tenantTs + tenantNonce;
    const signature = crypto.createHash('sha256').update(message).digest('hex');

    const headers = {
      'Tenant-Id': this.tenantId,
      'Request-Id': this.generateUUID(),
      'accept': 'application/json',
      'content-type': 'application/json',
      'Tenant-Ts': tenantTs,
      'Tenant-Nonce': tenantNonce,
      'Tenant-Signature': signature
    };

    try {
      const response = await this.makeRequest(body, headers);
      return this.formatResponse(response, query);
    } catch (error) {
      console.error('❌ Catalogue search error:', error);
      throw error;
    }
  }

  /**
   * Make HTTP request to NLB API
   */
  async makeRequest(body, headers) {
    return new Promise((resolve, reject) => {
      const postData = JSON.stringify(body);
      const url = new URL(this.apiUrl);

      const options = {
        hostname: url.hostname,
        path: url.pathname,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      req.write(postData);
      req.end();
    });
  }

  /**
   * Format API response for Kora (minimal data to prevent TTS reading metadata)
   */
  formatResponse(apiResponse, query) {
    try {
      const data = JSON.parse(apiResponse.body);
      
      if (!data.status?.success) {
        return {
          success: false,
          message: 'Search was not successful',
          results: []
        };
      }

      const results = data.content_value?.response_contents || [];
      
      if (results.length === 0) {
        return {
          success: true,
          message: `No results found for "${query}"`,
          results: []
        };
      }

      const formattedResults = results.map(item => {
        const extra = item.extra || {};
        
        // Parse cover image URL
        let coverUrl = null;
        try {
          const imageUrls = JSON.parse(extra.image_urls || '[]');
          coverUrl = imageUrls.length > 0 ? imageUrls[0] : null;
        } catch (e) {
          // Handle parse error silently
        }

        // Parse branch availability for Bishan
        let availableAtBishan = false;
        try {
          const branches = JSON.parse(extra.branch || '[]');
          availableAtBishan = branches.includes('BIPL') || branches.includes('Bishan');
        } catch (e) {
          // Handle parse error silently
        }

        return {
          contentId: extra.content_id || 'Unknown',
          title: (extra.content_title || 'Unknown Title').trim(),
          author: extra.content_owner_id || 'Unknown Author',
          contentType: extra.content_type || 'Book',
          language: extra.language || 'English',
          coverUrl: coverUrl,
          availableAtBishan: availableAtBishan,
          rank: item.rank || 0
        };
      });

      // Create response message for Kora
      const resultCount = formattedResults.length;
      const responseMessage = `Found ${resultCount} result${resultCount !== 1 ? 's' : ''} for "${query}":

${formattedResults.map((item, index) => 
  `${index + 1}. **${item.title}** by ${item.author}
   - Type: ${item.contentType}
   - Available at Bishan: ${item.availableAtBishan ? 'Yes' : 'No'}`
).join('\n\n')}`;

      return {
        success: true,
        message: responseMessage,
        results: formattedResults,
        query: query
      };

    } catch (error) {
      console.error('❌ Error formatting catalogue response:', error);
      return {
        success: false,
        message: 'Error processing search results',
        results: []
      };
    }
  }

  /**
   * Generate UUID for request ID
   */
  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}

module.exports = CatalogueSearchAPI;
