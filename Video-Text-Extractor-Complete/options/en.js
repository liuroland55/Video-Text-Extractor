// English version of options page script

class OptionsManager {
  constructor() {
    this.currentLang = 'en';
    this.apiConfig = {
      azure: { enabled: false },
      google: { enabled: false },
      mathpix: { enabled: false },
      ocrSpace: { enabled: true }
    };
    this.customAPIs = {};
    this.stats = {
      todayExtractions: 0,
      totalExtractions: 0,
      apiCalls: 0,
      successRate: 0
    };
    
    this.init();
  }

  async init() {
    // Load saved configuration
    await this.loadConfiguration();
    
    // Bind event listeners
    this.bindEvents();
    
    // Initialize UI
    this.initializeUI();
    
    // Load statistics
    await this.loadStatistics();
    
    // Check URL parameters for first install
    this.checkInstallParams();
  }

  async loadConfiguration() {
    try {
      const result = await chrome.storage.local.get(['apiConfig', 'customAPIs', 'generalSettings']);
      
      this.apiConfig = result.apiConfig || this.apiConfig;
      this.customAPIs = result.customAPIs || {};
      this.generalSettings = result.generalSettings || {
        defaultAPI: 'auto',
        autoFormat: true,
        saveHistory: true,
        language: 'en'
      };
      
      this.currentLang = this.generalSettings.language || 'en';
    } catch (error) {
      console.error('Failed to load configuration:', error);
    }
  }

  bindEvents() {
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const targetTab = e.target.dataset.tab;
        this.switchTab(targetTab);
      });
    });

    // API configuration buttons
    document.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', (e) => {
        const action = e.target.dataset.action;
        this.handleAction(action, e.target);
      });
    });

    // Custom API template selection
    const templateSelect = document.getElementById('custom-api-template');
    if (templateSelect) {
      templateSelect.addEventListener('change', (e) => {
        this.handleTemplateSelection(e.target.value);
      });
    }

    // Form inputs
    document.querySelectorAll('input[type="checkbox"], input[type="text"], input[type="url"], input[type="password"], select, textarea').forEach(input => {
      input.addEventListener('change', () => {
        this.markAsChanged();
      });
    });
  }

  initializeUI() {
    // Update API status indicators
    this.updateAPIStatus();
    
    // Load form values
    this.loadFormValues();
    
    // Update statistics display
    this.updateStatisticsDisplay();
  }

  updateAPIStatus() {
    const apis = ['azure', 'google', 'mathpix', 'ocrSpace'];
    
    apis.forEach(api => {
      const statusElement = document.getElementById(`${api}-status`);
      if (statusElement) {
        const isConfigured = this.apiConfig[api]?.enabled && this.hasValidCredentials(api);
        statusElement.textContent = isConfigured ? 'Configured' : 'Not Configured';
        statusElement.className = `api-status ${isConfigured ? 'status-configured' : 'status-not-configured'}`;
      }
    });
  }

  hasValidCredentials(api) {
    const config = this.apiConfig[api];
    if (!config) return false;
    
    switch (api) {
      case 'azure':
        return config.apiKey && config.endpoint;
      case 'google':
        return config.apiKey;
      case 'mathpix':
        return config.appId && config.appKey;
      case 'ocrSpace':
        return true; // OCR.space works with default key
      default:
        return false;
    }
  }

  loadFormValues() {
    // Load API configurations
    Object.keys(this.apiConfig).forEach(api => {
      const config = this.apiConfig[api];
      
      // Enable checkbox
      const enabledCheckbox = document.getElementById(`${api}-enabled`);
      if (enabledCheckbox) {
        enabledCheckbox.checked = config.enabled || false;
      }
      
      // API keys
      if (config.apiKey) {
        const keyInput = document.getElementById(`${api}-key`);
        if (keyInput) keyInput.value = config.apiKey;
      }
      
      // Additional fields
      if (config.endpoint) {
        const endpointInput = document.getElementById(`${api}-endpoint`);
        if (endpointInput) endpointInput.value = config.endpoint;
      }
      
      if (config.appId) {
        const appIdInput = document.getElementById(`${api}-app-id`);
        if (appIdInput) appIdInput.value = config.appId;
      }
      
      if (config.appKey) {
        const appKeyInput = document.getElementById(`${api}-app-key`);
        if (appKeyInput) appKeyInput.value = config.appKey;
      }
    });
    
    // Load general settings
    if (this.generalSettings) {
      const defaultAPISelect = document.getElementById('default-api');
      if (defaultAPISelect) {
        defaultAPISelect.value = this.generalSettings.defaultAPI || 'auto';
      }
      
      const autoFormatCheckbox = document.getElementById('auto-format');
      if (autoFormatCheckbox) {
        autoFormatCheckbox.checked = this.generalSettings.autoFormat !== false;
      }
      
      const saveHistoryCheckbox = document.getElementById('save-history');
      if (saveHistoryCheckbox) {
        saveHistoryCheckbox.checked = this.generalSettings.saveHistory !== false;
      }
    }
  }

  switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    
    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });
    document.getElementById(`${tabName}-tab`).classList.add('active');
  }

  async handleAction(action, button) {
    try {
      this.showLoading(true);
      
      switch (action) {
        case 'save-all':
          await this.saveAllConfiguration();
          break;
        case 'save-settings':
          await this.saveGeneralSettings();
          break;
        case 'test-azure':
          await this.testAPI('azure');
          break;
        case 'test-google':
          await this.testAPI('google');
          break;
        case 'test-mathpix':
          await this.testAPI('mathpix');
          break;
        case 'test-ocrspace':
          await this.testAPI('ocrSpace');
          break;
        case 'test-custom-api':
          await this.testCustomAPI();
          break;
        case 'save-custom-api':
          await this.saveCustomAPI();
          break;
        case 'reset-custom-api':
          this.resetCustomAPIForm();
          break;
        case 'tutorial-azure':
          this.openTutorial('azure');
          break;
        case 'tutorial-google':
          this.openTutorial('google');
          break;
        case 'tutorial-mathpix':
          this.openTutorial('mathpix');
          break;
        case 'template-zai':
          this.applyTemplate('zai');
          break;
        case 'apply-template-zai':
          this.applyTemplate('zai');
          break;
        case 'apply-template-baidu':
          this.applyTemplate('baidu');
          break;
        case 'apply-template-tencent':
          this.applyTemplate('tencent');
          break;
        case 'apply-template-aliyun':
          this.applyTemplate('aliyun');
          break;
        case 'apply-template-huawei':
          this.applyTemplate('huawei');
          break;
        case 'apply-template-aws':
          this.applyTemplate('aws');
          break;
        case 'clear-stats':
          await this.clearStatistics();
          break;
        case 'export-stats':
          await this.exportStatistics();
          break;
        default:
          console.warn('Unknown action:', action);
      }
    } catch (error) {
      console.error('Action failed:', error);
      this.showNotification(error.message, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async saveAllConfiguration() {
    // Collect API configurations
    const apis = ['azure', 'google', 'mathpix', 'ocrSpace'];
    
    apis.forEach(api => {
      const enabledCheckbox = document.getElementById(`${api}-enabled`);
      const keyInput = document.getElementById(`${api}-key`);
      const endpointInput = document.getElementById(`${api}-endpoint`);
      const appIdInput = document.getElementById(`${api}-app-id`);
      const appKeyInput = document.getElementById(`${api}-app-key`);
      
      this.apiConfig[api] = {
        enabled: enabledCheckbox?.checked || false,
        apiKey: keyInput?.value || '',
        endpoint: endpointInput?.value || '',
        appId: appIdInput?.value || '',
        appKey: appKeyInput?.value || ''
      };
    });
    
    // Save to storage
    await chrome.storage.local.set({ apiConfig: this.apiConfig });
    
    // Update UI
    this.updateAPIStatus();
    this.showNotification('All API configurations saved successfully!', 'success');
  }

  async saveGeneralSettings() {
    const defaultAPISelect = document.getElementById('default-api');
    const autoFormatCheckbox = document.getElementById('auto-format');
    const saveHistoryCheckbox = document.getElementById('save-history');
    
    this.generalSettings = {
      defaultAPI: defaultAPISelect?.value || 'auto',
      autoFormat: autoFormatCheckbox?.checked !== false,
      saveHistory: saveHistoryCheckbox?.checked !== false,
      language: this.currentLang
    };
    
    await chrome.storage.local.set({ generalSettings: this.generalSettings });
    this.showNotification('General settings saved successfully!', 'success');
  }

  async testAPI(api) {
    const config = this.apiConfig[api];
    if (!config.enabled) {
      throw new Error('Please enable the API before testing');
    }
    
    const testResult = await this.sendTestRequest(api, config);
    this.displayTestResult(api, testResult);
  }

  async sendTestRequest(api, config) {
    try {
      let response;
      
      switch (api) {
        case 'azure':
          response = await this.testAzureVision(config);
          break;
        case 'google':
          response = await this.testGoogleVision(config);
          break;
        case 'mathpix':
          response = await this.testMathpix(config);
          break;
        case 'ocrSpace':
          response = await this.testOCRSpace(config);
          break;
        default:
          throw new Error('Unsupported API for testing');
      }
      
      return { success: true, data: response };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testAzureVision(config) {
    const response = await fetch(`${config.endpoint}/vision/v3.2/analyze?visualFeatures=Description`, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://via.placeholder.com/150x150.png?text=Test'
      })
    });
    
    if (!response.ok) {
      throw new Error(`Azure Vision API error: ${response.status}`);
    }
    
    return response.json();
  }

  async testGoogleVision(config) {
    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${config.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{
          image: {
            source: {
              imageUri: 'https://via.placeholder.com/150x150.png?text=Test'
            }
          },
          features: [{ type: 'TEXT_DETECTION' }]
        }]
      })
    });
    
    if (!response.ok) {
      throw new Error(`Google Vision API error: ${response.status}`);
    }
    
    return response.json();
  }

  async testMathpix(config) {
    const response = await fetch('https://api.mathpix.com/v3/text', {
      method: 'POST',
      headers: {
        'app_id': config.appId,
        'app_key': config.appKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        src: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
      })
    });
    
    if (!response.ok) {
      throw new Error(`Mathpix API error: ${response.status}`);
    }
    
    return response.json();
  }

  async testOCRSpace(config) {
    const formData = new FormData();
    formData.append('file', new Blob(['test'], { type: 'text/plain' }), 'test.png');
    formData.append('language', 'eng');
    formData.append('isOverlayRequired', 'false');
    
    const apiKey = config.apiKey || 'helloworld';
    const response = await fetch(`https://api.ocr.space/parse/image?apikey=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`OCR.space API error: ${response.status}`);
    }
    
    return response.json();
  }

  displayTestResult(api, result) {
    const resultElement = document.getElementById(`${api}-test-result`);
    if (!resultElement) return;
    
    if (result.success) {
      resultElement.innerHTML = `
        <strong>✅ Connection Successful!</strong><br>
        API is responding correctly. Configuration is valid.
      `;
      resultElement.className = 'test-result success show';
    } else {
      resultElement.innerHTML = `
        <strong>❌ Connection Failed!</strong><br>
        Error: ${result.error}
      `;
      resultElement.className = 'test-result error show';
    }
    
    // Hide result after 5 seconds
    setTimeout(() => {
      resultElement.classList.remove('show');
    }, 5000);
  }

  handleTemplateSelection(template) {
    const form = document.getElementById('custom-api-form');
    if (template === 'custom') {
      form.style.display = 'block';
    } else if (template) {
      form.style.display = 'block';
      this.applyTemplate(template);
    } else {
      form.style.display = 'none';
    }
  }

  applyTemplate(template) {
    const templates = {
      zai: {
        name: 'ZAI Smart OCR',
        url: 'https://api.zai.ai/v1/ocr',
        method: 'POST',
        keyHeader: 'Authorization',
        dataFormat: 'json',
        imageField: 'image',
        responsePath: 'result.text'
      },
      baidu: {
        name: 'Baidu OCR',
        url: 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic',
        method: 'POST',
        keyHeader: 'access_token',
        dataFormat: 'form-data',
        imageField: 'image',
        responsePath: 'words_result'
      },
      tencent: {
        name: 'Tencent OCR',
        url: 'https://ocr.tencentcloudapi.com/',
        method: 'POST',
        keyHeader: 'Authorization',
        dataFormat: 'json',
        imageField: 'ImageBase64',
        responsePath: 'Response.TextDetections'
      },
      aliyun: {
        name: 'Alibaba Cloud OCR',
        url: 'https://ocr-api.cn-hangzhou.aliyuncs.com/api/v1/ocr/general_text',
        method: 'POST',
        keyHeader: 'Authorization',
        dataFormat: 'json',
        imageField: 'image',
        responsePath: 'data.content'
      },
      huawei: {
        name: 'Huawei Cloud OCR',
        url: 'https://ocr.cn-north-4.myhuaweicloud.com/v2.0/ocr/web-image',
        method: 'POST',
        keyHeader: 'X-Auth-Token',
        dataFormat: 'json',
        imageField: 'image',
        responsePath: 'result.words_block_count'
      },
      aws: {
        name: 'Amazon Textract',
        url: 'https://textract.us-east-1.amazonaws.com/',
        method: 'POST',
        keyHeader: 'X-Amz-Target',
        dataFormat: 'json',
        imageField: 'Image',
        responsePath: 'Blocks'
      }
    };
    
    const templateConfig = templates[template];
    if (!templateConfig) return;
    
    // Fill form with template values
    document.getElementById('custom-api-name').value = templateConfig.name;
    document.getElementById('custom-api-url').value = templateConfig.url;
    document.getElementById('custom-api-method').value = templateConfig.method;
    document.getElementById('custom-api-key-header').value = templateConfig.keyHeader;
    document.getElementById('custom-api-data-format').value = templateConfig.dataFormat;
    document.getElementById('custom-api-image-field').value = templateConfig.imageField;
    document.getElementById('custom-api-response-path').value = templateConfig.responsePath;
    
    // Update template selector
    document.getElementById('custom-api-template').value = template;
  }

  resetCustomAPIForm() {
    document.getElementById('custom-api-template').value = '';
    document.getElementById('custom-api-form').style.display = 'none';
    
    // Clear all form fields
    const form = document.getElementById('custom-api-form');
    form.querySelectorAll('input, select, textarea').forEach(field => {
      if (field.type === 'checkbox') {
        field.checked = false;
      } else {
        field.value = '';
      }
    });
  }

  async saveCustomAPI() {
    const name = document.getElementById('custom-api-name').value;
    const url = document.getElementById('custom-api-url').value;
    const key = document.getElementById('custom-api-key').value;
    
    if (!name || !url) {
      throw new Error('API name and URL are required');
    }
    
    const customAPI = {
      name,
      url,
      enabled: true,
      apiKey: key,
      method: document.getElementById('custom-api-method').value,
      keyHeader: document.getElementById('custom-api-key-header').value,
      dataFormat: document.getElementById('custom-api-data-format').value,
      imageField: document.getElementById('custom-api-image-field').value,
      responsePath: document.getElementById('custom-api-response-path').value,
      headers: document.getElementById('custom-api-headers').value
    };
    
    this.customAPIs[name] = customAPI;
    await chrome.storage.local.set({ customAPIs: this.customAPIs });
    
    this.showNotification('Custom API saved successfully!', 'success');
    this.resetCustomAPIForm();
  }

  async testCustomAPI() {
    const name = document.getElementById('custom-api-name').value;
    const customAPI = this.customAPIs[name];
    
    if (!customAPI) {
      throw new Error('Please save the custom API configuration first');
    }
    
    try {
      // Create a test request based on the custom API configuration
      const response = await fetch(customAPI.url, {
        method: customAPI.method,
        headers: {
          [customAPI.keyHeader]: customAPI.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          [customAPI.imageField]: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
        })
      });
      
      if (response.ok) {
        this.showNotification('Custom API connection successful!', 'success');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Custom API test failed: ${error.message}`);
    }
  }

  openTutorial(api) {
    const tutorials = {
      azure: 'https://docs.microsoft.com/en-us/azure/cognitive-services/computer-vision/',
      google: 'https://cloud.google.com/vision/docs',
      mathpix: 'https://mathpix.com/docs',
      zai: 'https://docs.zai.ai'
    };
    
    const url = tutorials[api];
    if (url) {
      chrome.tabs.create({ url });
    }
  }

  async loadStatistics() {
    try {
      const result = await chrome.storage.local.get(['usageStats']);
      this.stats = result.usageStats || this.stats;
      this.updateStatisticsDisplay();
    } catch (error) {
      console.error('Failed to load statistics:', error);
    }
  }

  updateStatisticsDisplay() {
    document.getElementById('today-extractions').textContent = this.stats.todayExtractions || 0;
    document.getElementById('total-extractions').textContent = this.stats.totalExtractions || 0;
    document.getElementById('api-calls').textContent = this.stats.apiCalls || 0;
    document.getElementById('success-rate').textContent = `${this.stats.successRate || 0}%`;
  }

  async clearStatistics() {
    if (!confirm('Are you sure you want to clear all statistics?')) {
      return;
    }
    
    this.stats = {
      todayExtractions: 0,
      totalExtractions: 0,
      apiCalls: 0,
      successRate: 0
    };
    
    await chrome.storage.local.set({ usageStats: this.stats });
    this.updateStatisticsDisplay();
    this.showNotification('Statistics cleared successfully!', 'success');
  }

  async exportStatistics() {
    const data = {
      statistics: this.stats,
      apiConfig: this.apiConfig,
      customAPIs: this.customAPIs,
      exportDate: new Date().toISOString()
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-text-extractor-stats-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    this.showNotification('Statistics exported successfully!', 'success');
  }

  checkInstallParams() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('firstInstall') === 'true') {
      this.showNotification('Welcome! Please configure your OCR services to get started.', 'info');
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  showLoading(show) {
    const loadingElement = document.getElementById('loading');
    if (loadingElement) {
      loadingElement.classList.toggle('show', show);
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    if (notification && notificationText) {
      notificationText.textContent = message;
      notification.className = `notification ${type} show`;
      
      setTimeout(() => {
        notification.classList.remove('show');
      }, 3000);
    }
  }

  markAsChanged() {
    // Add visual indicator that settings have changed
    document.title = '* API Settings - Video Text Extractor';
  }

  async switchLanguage(lang) {
    if (lang === this.currentLang) return;
    
    this.currentLang = lang;
    this.generalSettings.language = lang;
    await chrome.storage.local.set({ generalSettings: this.generalSettings });
    
    // Reload page with new language
    if (lang === 'zh') {
      window.location.href = 'options.html';
    } else {
      window.location.href = 'en.html';
    }
  }
}

// Language switching function for global access
function switchLanguage(lang) {
  if (window.optionsManager) {
    window.optionsManager.switchLanguage(lang);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.optionsManager = new OptionsManager();
});
