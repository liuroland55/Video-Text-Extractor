// Options page script for Video Text Extractor

class OptionsManager {
  constructor() {
    this.apiConfig = {};
    this.generalSettings = {};
    this.stats = {};
    this.customAPITemplates = {};
    this.init();
  }

  async init() {
    try {
      // 检查是否是首次安装
      this.checkFirstInstall();
      
      // 加载配置
      await this.loadConfigs();
      
      // 加载自定义API模板
      this.loadAPITemplates();
      
      // 绑定事件
      this.bindEvents();
      
      // 更新UI
      this.updateUI();
      
      // 加载统计
      await this.loadStats();
      
    } catch (error) {
      console.error('Options init error:', error);
      this.showNotification('设置页面加载失败', 'error');
    }
  }

  checkFirstInstall() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('firstInstall') === 'true') {
      setTimeout(() => {
        this.showNotification('欢迎安装Video Text Extractor！建议先配置OCR API以获得更好效果', 'info');
      }, 1000);
    }
  }

  async loadConfigs() {
    const result = await chrome.storage.local.get(['apiConfig', 'generalSettings', 'customAPIs']);
    
    this.apiConfig = result.apiConfig || {
      azure: { enabled: false },
      google: { enabled: false },
      mathpix: { enabled: false },
      ocrSpace: { enabled: true }
    };
    
    this.generalSettings = result.generalSettings || {
      defaultAPI: 'auto',
      autoFormat: true,
      saveHistory: true,
      shortcutKey: 'Ctrl+Shift+V'
    };

    this.customAPIs = result.customAPIs || {};
  }

  loadAPITemplates() {
    // 预定义的API模板
    this.customAPITemplates = {
      zai: {
        name: 'ZAI 智能OCR',
        url: 'https://api.zai.ai/v1/ocr',
        method: 'POST',
        keyHeader: 'Authorization',
        dataFormat: 'json',
        imageField: 'image',
        responsePath: 'result.text',
        headers: { 'Content-Type': 'application/json' },
        description: '专业的AI文档识别服务，支持多语言、高精度OCR识别'
      },
      baidu: {
        name: '百度 OCR',
        url: 'https://aip.baidubce.com/rest/2.0/ocr/v1/general_basic',
        method: 'POST',
        keyHeader: 'access_token',
        dataFormat: 'form-data',
        imageField: 'image',
        responsePath: 'words_result',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        description: '百度云提供的OCR服务，支持通用文字识别、身份证识别等'
      },
      tencent: {
        name: '腾讯 OCR',
        url: 'https://ocr.tencentcloudapi.com/',
        method: 'POST',
        keyHeader: 'Authorization',
        dataFormat: 'json',
        imageField: 'ImageBase64',
        responsePath: 'Response.TextDetections',
        headers: { 'Content-Type': 'application/json' },
        description: '腾讯云文字识别服务，支持多种场景的文字识别'
      },
      aliyun: {
        name: '阿里云 OCR',
        url: 'https://ocr-api.cn-hangzhou.aliyuncs.com/api/v1/ocr/general/text',
        method: 'POST',
        keyHeader: 'Authorization',
        dataFormat: 'json',
        imageField: 'body',
        responsePath: 'Data.content',
        headers: { 'Content-Type': 'application/json' },
        description: '阿里云提供的文字识别服务，支持多种证件识别'
      },
      huawei: {
        name: '华为云 OCR',
        url: 'https://ocr.cn-north-4.myhuaweicloud.com/v2.0/ocr/general-text',
        method: 'POST',
        keyHeader: 'X-Auth-Token',
        dataFormat: 'json',
        imageField: 'image',
        responsePath: 'result.words_region_list',
        headers: { 'Content-Type': 'application/json' },
        description: '华为云文字识别服务，支持通用文字识别、手写文字识别等'
      },
      aws: {
        name: 'Amazon Textract',
        url: 'https://textract.us-east-1.amazonaws.com/',
        method: 'POST',
        keyHeader: 'X-Amz-Target',
        dataFormat: 'json',
        imageField: 'Document',
        responsePath: 'Blocks',
        headers: { 
          'Content-Type': 'application/x-amz-json-1.0',
          'X-Amz-Target': 'Textract.DetectDocumentText'
        },
        description: 'AWS提供的文档分析服务，可以从扫描的文档中提取文本'
      }
    };
  }

  bindEvents() {
    // 标签页切换事件
    document.querySelectorAll('[data-tab]').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const tabName = e.target.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });

    // 按钮动作事件
    document.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', (e) => {
        const action = e.target.getAttribute('data-action');
        this.handleAction(action);
      });
    });

    // API配置变更监听
    document.getElementById('azure-enabled').addEventListener('change', () => {
      this.apiConfig.azure.enabled = document.getElementById('azure-enabled').checked;
      this.updateAPIStatus('azure');
    });

    document.getElementById('google-enabled').addEventListener('change', () => {
      this.apiConfig.google.enabled = document.getElementById('google-enabled').checked;
      this.updateAPIStatus('google');
    });

    document.getElementById('mathpix-enabled').addEventListener('change', () => {
      this.apiConfig.mathpix.enabled = document.getElementById('mathpix-enabled').checked;
      this.updateAPIStatus('mathpix');
    });

    document.getElementById('ocrSpace-enabled').addEventListener('change', () => {
      this.apiConfig.ocrSpace.enabled = document.getElementById('ocrSpace-enabled').checked;
      this.updateAPIStatus('ocrSpace');
    });

    // API密钥输入监听
    ['azure-key', 'azure-endpoint', 'google-key', 'mathpix-app-id', 'mathpix-app-key', 'ocrSpace-key'].forEach(id => {
      const element = document.getElementById(id);
      element.addEventListener('input', () => {
        this.updateAPIConfigFromInput(id, element.value);
      });
    });

    // 通用设置监听
    document.getElementById('default-api').addEventListener('change', () => {
      this.generalSettings.defaultAPI = document.getElementById('default-api').value;
    });

    document.getElementById('auto-format').addEventListener('change', () => {
      this.generalSettings.autoFormat = document.getElementById('auto-format').checked;
    });

    document.getElementById('save-history').addEventListener('change', () => {
      this.generalSettings.saveHistory = document.getElementById('save-history').checked;
    });

    // 自定义API模板选择
    document.getElementById('custom-api-template').addEventListener('change', (e) => {
      const templateName = e.target.value;
      if (templateName && this.customAPITemplates[templateName]) {
        this.applyTemplate(templateName);
      } else if (templateName === 'custom') {
        this.showCustomAPIForm();
      } else {
        this.hideCustomAPIForm();
      }
    });
  }

  handleAction(action) {
    switch (action) {
      case 'test-azure':
        this.testAzureAPI();
        break;
      case 'test-google':
        this.testGoogleAPI();
        break;
      case 'test-mathpix':
        this.testMathpixAPI();
        break;
      case 'test-ocrspace':
        this.testOCRSpaceAPI();
        break;
      case 'tutorial-azure':
        this.openAzureTutorial();
        break;
      case 'tutorial-google':
        this.openGoogleTutorial();
        break;
      case 'tutorial-mathpix':
        this.openMathpixTutorial();
        break;
      case 'save-all':
        this.saveAllConfigs();
        break;
      case 'save-settings':
        this.saveGeneralSettings();
        break;
      case 'clear-stats':
        this.clearStats();
        break;
      case 'export-stats':
        this.exportStats();
        break;
      case 'save-custom-api':
        this.saveCustomAPI();
        break;
      case 'test-custom-api':
        this.testCustomAPI();
        break;
      case 'reset-custom-api':
        this.resetCustomAPI();
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
    }
  }

  updateAPIConfigFromInput(inputId, value) {
    switch (inputId) {
      case 'azure-key':
        this.apiConfig.azure.apiKey = value;
        break;
      case 'azure-endpoint':
        this.apiConfig.azure.endpoint = value;
        break;
      case 'google-key':
        this.apiConfig.google.apiKey = value;
        break;
      case 'mathpix-app-id':
        this.apiConfig.mathpix.appId = value;
        break;
      case 'mathpix-app-key':
        this.apiConfig.mathpix.appKey = value;
        break;
      case 'ocrSpace-key':
        this.apiConfig.ocrSpace.apiKey = value;
        break;
    }
  }

  updateUI() {
    // 更新API配置UI
    this.updateAPIConfigUI('azure');
    this.updateAPIConfigUI('google');
    this.updateAPIConfigUI('mathpix');
    this.updateAPIConfigUI('ocrSpace');

    // 更新通用设置UI
    document.getElementById('default-api').value = this.generalSettings.defaultAPI;
    document.getElementById('auto-format').checked = this.generalSettings.autoFormat;
    document.getElementById('save-history').checked = this.generalSettings.saveHistory;
    document.getElementById('shortcut-key').value = this.generalSettings.shortcutKey;

    // 更新API状态
    ['azure', 'google', 'mathpix', 'ocrSpace'].forEach(api => {
      this.updateAPIStatus(api);
    });
  }

  updateAPIConfigUI(apiName) {
    const config = this.apiConfig[apiName];
    
    document.getElementById(`${apiName}-enabled`).checked = config.enabled || false;
    
    if (config.apiKey) {
      document.getElementById(`${apiName}-key`).value = config.apiKey;
    }
    
    if (config.endpoint) {
      document.getElementById(`${apiName}-endpoint`).value = config.endpoint;
    }
    
    if (config.appId) {
      document.getElementById(`${apiName}-app-id`).value = config.appId;
    }
    
    if (config.appKey) {
      document.getElementById(`${apiName}-app-key`).value = config.appKey;
    }
  }

  updateAPIStatus(apiName) {
    const config = this.apiConfig[apiName];
    const statusElement = document.getElementById(`${apiName}-status`);
    
    if (apiName === 'ocrSpace') {
      statusElement.textContent = config.enabled ? '已启用' : '未启用';
      statusElement.className = config.enabled ? 'api-status status-configured' : 'api-status status-not-configured';
    } else {
      const hasCredentials = this.hasValidCredentials(apiName);
      const isEnabled = config.enabled;
      
      if (isEnabled && hasCredentials) {
        statusElement.textContent = '已配置';
        statusElement.className = 'api-status status-configured';
      } else if (isEnabled) {
        statusElement.textContent = '未配置';
        statusElement.className = 'api-status status-not-configured';
      } else {
        statusElement.textContent = '已禁用';
        statusElement.className = 'api-status status-not-configured';
      }
    }
  }

  hasValidCredentials(apiName) {
    const config = this.apiConfig[apiName];
    
    switch (apiName) {
      case 'azure':
        return config.apiKey && config.endpoint;
      case 'google':
        return config.apiKey;
      case 'mathpix':
        return config.appId && config.appKey;
      case 'ocrSpace':
        return true; // OCR.space不需要密钥
      default:
        return false;
    }
  }

  async loadStats() {
    const result = await chrome.storage.local.get(['usageStats']);
    this.stats = result.usageStats || {
      today: 0,
      total: 0,
      success: 0,
      failed: 0,
      apiCalls: 0,
      lastResetDate: new Date().toDateString()
    };

    this.updateStatsUI();
  }

  updateStatsUI() {
    document.getElementById('today-extractions').textContent = this.stats.today || 0;
    document.getElementById('total-extractions').textContent = this.stats.total || 0;
    document.getElementById('api-calls').textContent = this.stats.apiCalls || 0;
    
    const successRate = this.stats.total > 0 
      ? Math.round((this.stats.success / this.stats.total) * 100) 
      : 0;
    document.getElementById('success-rate').textContent = `${successRate}%`;

    // 简单的图表显示
    this.updateUsageChart();
  }

  updateUsageChart() {
    const chartContainer = document.getElementById('api-usage-chart');
    
    // 创建简单的条形图
    const apiUsage = {
      'Azure': 0,
      'Google': 0,
      'Mathpix': 0,
      'OCR.space': 0,
      '自定义': 0
    };

    // 这里可以添加实际的API使用统计逻辑
    const chartHTML = `
      <div style="display: flex; justify-content: space-around; align-items: flex-end; height: 150px;">
        ${Object.entries(apiUsage).map(([name, count]) => `
          <div style="text-align: center;">
            <div style="width: 60px; height: ${Math.max(count * 2, 10)}px; background: #007acc; border-radius: 4px; margin-bottom: 8px;"></div>
            <div style="font-size: 12px; color: #6c757d;">${name}</div>
            <div style="font-size: 14px; font-weight: 600;">${count}</div>
          </div>
        `).join('')}
      </div>
      <div style="text-align: center; margin-top: 10px; color: #6c757d; font-size: 12px;">
        API使用次数统计
      </div>
    `;
    
    chartContainer.innerHTML = chartHTML;
  }

  async saveAllConfigs() {
    try {
      this.showLoading(true);
      
      // 保存API配置
      await chrome.storage.local.set({ apiConfig: this.apiConfig });
      
      // 保存通用设置
      await chrome.storage.local.set({ generalSettings: this.generalSettings });
      
      this.showNotification('所有配置已保存', 'success');
      
      // 通知background script配置已更新
      chrome.runtime.sendMessage({ action: 'configUpdated' });
      
    } catch (error) {
      console.error('Save config error:', error);
      this.showNotification('保存配置失败', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async saveGeneralSettings() {
    try {
      await chrome.storage.local.set({ generalSettings: this.generalSettings });
      this.showNotification('通用设置已保存', 'success');
      
      chrome.runtime.sendMessage({ action: 'configUpdated' });
    } catch (error) {
      console.error('Save settings error:', error);
      this.showNotification('保存设置失败', 'error');
    }
  }

  // 自定义API相关方法
  applyTemplate(templateName) {
    const template = this.customAPITemplates[templateName];
    if (!template) return;

    this.showCustomAPIForm();
    
    document.getElementById('custom-api-name').value = template.name;
    document.getElementById('custom-api-url').value = template.url;
    document.getElementById('custom-api-method').value = template.method;
    document.getElementById('custom-api-key-header').value = template.keyHeader;
    document.getElementById('custom-api-data-format').value = template.dataFormat;
    document.getElementById('custom-api-image-field').value = template.imageField;
    document.getElementById('custom-api-response-path').value = template.responsePath;
    document.getElementById('custom-api-headers').value = JSON.stringify(template.headers, null, 2);
    
    this.showNotification(`已应用${template.name}模板`, 'info');
  }

  showCustomAPIForm() {
    document.getElementById('custom-api-form').style.display = 'block';
  }

  hideCustomAPIForm() {
    document.getElementById('custom-api-form').style.display = 'none';
  }

  async saveCustomAPI() {
    try {
      const name = document.getElementById('custom-api-name').value;
      if (!name) {
        this.showNotification('请输入API名称', 'error');
        return;
      }

      const config = {
        name: name,
        url: document.getElementById('custom-api-url').value,
        method: document.getElementById('custom-api-method').value,
        apiKey: document.getElementById('custom-api-key').value,
        keyHeader: document.getElementById('custom-api-key-header').value,
        dataFormat: document.getElementById('custom-api-data-format').value,
        imageField: document.getElementById('custom-api-image-field').value,
        responsePath: document.getElementById('custom-api-response-path').value,
        headers: this.parseHeaders(document.getElementById('custom-api-headers').value),
        enabled: true
      };

      // 保存自定义API配置
      const apiName = 'custom_' + name.toLowerCase().replace(/\s+/g, '_');
      this.customAPIs[apiName] = config;
      
      await chrome.storage.local.set({ customAPIs: this.customAPIs });
      
      this.showNotification('自定义API已保存', 'success');
      
    } catch (error) {
      console.error('Save custom API error:', error);
      this.showNotification('保存自定义API失败', 'error');
    }
  }

  async testCustomAPI() {
    try {
      this.showLoading(true);
      
      const config = {
        url: document.getElementById('custom-api-url').value,
        method: document.getElementById('custom-api-method').value,
        apiKey: document.getElementById('custom-api-key').value,
        keyHeader: document.getElementById('custom-api-key-header').value,
        dataFormat: document.getElementById('custom-api-data-format').value,
        imageField: document.getElementById('custom-api-image-field').value,
        responsePath: document.getElementById('custom-api-response-path').value,
        headers: this.parseHeaders(document.getElementById('custom-api-headers').value)
      };

      const result = await this.testCustomAPIConnection(config);
      
      if (result.success) {
        this.showNotification('自定义API连接成功！', 'success');
      } else {
        this.showNotification(`连接失败: ${result.error}`, 'error');
      }
      
    } catch (error) {
      console.error('Test custom API error:', error);
      this.showNotification('测试自定义API失败', 'error');
    } finally {
      this.showLoading(false);
    }
  }

  async testCustomAPIConnection(config) {
    try {
      // 创建测试图片数据
      const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      let body;
      let headers = { ...config.headers };
      
      if (config.apiKey) {
        headers[config.keyHeader] = config.apiKey;
      }

      if (config.dataFormat === 'json') {
        body = JSON.stringify({ [config.imageField]: testImageData });
      } else if (config.dataFormat === 'form-data') {
        body = new FormData();
        body.append(config.imageField, this.dataURLtoBlob(testImageData), 'test.png');
      } else {
        body = testImageData;
      }

      const response = await fetch(config.url, {
        method: config.method,
        headers: headers,
        body: body
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      const result = await response.json();
      const extractedText = this.extractTextFromResponse(result, config.responsePath);
      
      return { 
        success: true, 
        responseTime: Date.now(),
        text: extractedText
      };
      
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  extractTextFromResponse(response, path) {
    try {
      const pathParts = path.split('.');
      let result = response;
      
      for (const part of pathParts) {
        if (result && typeof result === 'object') {
          result = result[part];
        } else {
          break;
        }
      }
      
      if (Array.isArray(result)) {
        return result.map(item => item.words || item.text || item).join('\n');
      }
      
      return result || '无法提取文本';
    } catch (error) {
      return '响应解析失败';
    }
  }

  parseHeaders(headersText) {
    try {
      if (!headersText.trim()) return {};
      return JSON.parse(headersText);
    } catch (error) {
      console.error('Parse headers error:', error);
      return {};
    }
  }

  resetCustomAPI() {
    document.getElementById('custom-api-name').value = '';
    document.getElementById('custom-api-url').value = '';
    document.getElementById('custom-api-key').value = '';
    document.getElementById('custom-api-key-header').value = 'Authorization';
    document.getElementById('custom-api-data-format').value = 'json';
    document.getElementById('custom-api-image-field').value = 'image';
    document.getElementById('custom-api-response-path').value = 'result.text';
    document.getElementById('custom-api-headers').value = '{"Content-Type": "application/json"}';
    
    this.showNotification('表单已重置', 'info');
  }

  // API测试方法
  async testAzureAPI() {
    await this.testAPI('azure', () => this.testAzureConnection());
  }

  async testGoogleAPI() {
    await this.testAPI('google', () => this.testGoogleConnection());
  }

  async testMathpixAPI() {
    await this.testAPI('mathpix', () => this.testMathpixConnection());
  }

  async testOCRSpaceAPI() {
    await this.testAPI('ocrSpace', () => this.testOCRSpaceConnection());
  }

  async testAPI(apiName, testFunction) {
    const resultElement = document.getElementById(`${apiName}-test-result`);
    
    try {
      this.showLoading(true);
      resultElement.className = 'test-result';
      resultElement.textContent = '正在测试连接...';
      
      const result = await testFunction();
      
      if (result.success) {
        resultElement.className = 'test-result success show';
        resultElement.textContent = `✅ 连接成功！响应时间: ${result.responseTime}ms`;
      } else {
        resultElement.className = 'test-result error show';
        resultElement.textContent = `❌ 连接失败: ${result.error}`;
      }
      
    } catch (error) {
      resultElement.className = 'test-result error show';
      resultElement.textContent = `❌ 测试失败: ${error.message}`;
    } finally {
      this.showLoading(false);
    }
  }

  async testAzureConnection() {
    const config = this.apiConfig.azure;
    if (!config.apiKey || !config.endpoint) {
      throw new Error('请先填写API密钥和终结点');
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch(`${config.endpoint}vision/v3.2/models`, {
        headers: {
          'Ocp-Apim-Subscription-Key': config.apiKey
        }
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        return { success: true, responseTime };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testGoogleConnection() {
    const config = this.apiConfig.google;
    if (!config.apiKey) {
      throw new Error('请先填写API密钥');
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch(`https://vision.googleapis.com/v1/models?key=${config.apiKey}`);
      
      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        return { success: true, responseTime };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testMathpixConnection() {
    const config = this.apiConfig.mathpix;
    if (!config.appId || !config.appKey) {
      throw new Error('请先填写App ID和App Key');
    }

    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.mathpix.com/v3/app_info', {
        headers: {
          'app_id': config.appId,
          'app_key': config.appKey
        }
      });

      const responseTime = Date.now() - startTime;
      
      if (response.ok) {
        return { success: true, responseTime };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async testOCRSpaceConnection() {
    const startTime = Date.now();
    
    try {
      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        headers: {
          'apikey': this.apiConfig.ocrSpace.apiKey || 'helloworld'
        }
      });

      const responseTime = Date.now() - startTime;
      
      // OCR.space可能返回400因为没有图片，但说明服务可用
      if (response.status === 400 || response.ok) {
        return { success: true, responseTime };
      } else {
        return { success: false, error: `HTTP ${response.status}` };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // 教程链接
  openAzureTutorial() {
    chrome.tabs.create({
      url: 'https://azure.microsoft.com/zh-cn/services/cognitive-services/computer-vision/'
    });
  }

  openGoogleTutorial() {
    chrome.tabs.create({
      url: 'https://cloud.google.com/vision/docs'
    });
  }

  openMathpixTutorial() {
    chrome.tabs.create({
      url: 'https://mathpix.com/docs'
    });
  }

  // 统计方法
  async clearStats() {
    if (confirm('确定要清除所有使用统计吗？此操作不可撤销。')) {
      await chrome.storage.local.remove(['usageStats']);
      this.stats = {};
      this.updateStatsUI();
      this.showNotification('统计数据已清除', 'success');
    }
  }

  async exportStats() {
    const statsData = {
      stats: this.stats,
      apiConfig: this.apiConfig,
      generalSettings: this.generalSettings,
      customAPIs: this.customAPIs,
      exportTime: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(statsData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-text-extractor-stats-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    this.showNotification('统计数据已导出', 'success');
  }

  // UI辅助方法
  switchTab(tabName) {
    // 隐藏所有标签页
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.remove('active');
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.remove('active');
    });

    // 显示选中的标签页
    const targetTab = document.querySelector(`[data-tab="${tabName}"]`);
    if (targetTab) {
      targetTab.classList.add('active');
    }
    
    const targetContent = document.getElementById(`${tabName}-tab`);
    if (targetContent) {
      targetContent.classList.add('active');
    }
  }

  showLoading(show) {
    const loading = document.getElementById('loading');
    if (show) {
      loading.classList.add('show');
    } else {
      loading.classList.remove('show');
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const notificationText = document.getElementById('notificationText');
    
    notificationText.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
      notification.classList.remove('show');
    }, 3000);
  }

  dataURLtoBlob(dataURL) {
    try {
      const arr = dataURL.split(',');
      const mime = arr[0].match(/:(.*?);/)[1];
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      
      while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
      }
      
      return new Blob([u8arr], { type: mime });
    } catch (error) {
      console.error('Data URL to blob conversion error:', error);
      throw new Error('Failed to convert image data');
    }
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  window.optionsManager = new OptionsManager();
  
  // 添加键盘快捷键
  document.addEventListener('keydown', (e) => {
    // Ctrl+S 保存配置
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      window.optionsManager.saveAllConfigs();
    }
  });
  
  // 防止意外关闭
  window.addEventListener('beforeunload', (e) => {
    const hasUnsavedChanges = false; // 这里可以检查是否有未保存的更改
    if (hasUnsavedChanges) {
      e.preventDefault();
      e.returnValue = '您有未保存的更改，确定要离开吗？';
    }
  });
});
