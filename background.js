// Background service worker for Video Text Extractor

class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    // 监听插件图标点击
    chrome.action.onClicked.addListener((tab) => {
      this.handleActionClick(tab);
    });

    // 监听来自content script的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true; // 保持消息通道开放
    });

    // 监听插件安装
    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstall(details);
    });
  }

  async handleActionClick(tab) {
    try {
      // 检查当前页面是否有视频
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: this.checkForVideos
      });

      const hasVideo = results[0]?.result;
      
      if (!hasVideo) {
        // 如果没有视频，显示提示
        chrome.tabs.sendMessage(tab.id, {
          action: 'showNotification',
          message: '当前页面未检测到视频元素'
        });
        return;
      }

      // 发送激活消息到content script
      chrome.tabs.sendMessage(tab.id, {
        action: 'activateExtraction'
      });

    } catch (error) {
      console.error('Action click error:', error);
    }
  }

  checkForVideos() {
    const videos = document.querySelectorAll('video');
    return videos.length > 0;
  }

  async handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'captureAndExtract':
        await this.handleCaptureAndExtract(request, sender, sendResponse);
        break;
      
      case 'openResultPage':
        await this.openResultPage(request.data);
        sendResponse({ success: true });
        break;
      
      case 'getAPIConfig':
        const config = await this.getAPIConfig();
        sendResponse({ config });
        break;
      
      case 'saveAPIConfig':
        await this.saveAPIConfig(request.config);
        sendResponse({ success: true });
        break;
      
      case 'contentScriptReady':
        // Content script已就绪
        sendResponse({ status: 'acknowledged' });
        break;
      
      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  async handleCaptureAndExtract(request, sender, sendResponse) {
    try {
      const { imageData, videoInfo } = request;
      
      // 获取API配置
      const apiConfig = await this.getAPIConfig();
      
      // 选择最佳API
      const selectedAPI = this.selectBestAPI(apiConfig, videoInfo);
      
      if (!selectedAPI) {
        // 即使没有配置API，也尝试使用OCR.space免费版本
        console.log('No configured APIs, using OCR.space free tier');
        const freeAPI = { type: 'ocrSpace', apiKey: 'helloworld' };
        const ocrResult = await this.callOCRService(freeAPI, imageData);
        const processedResult = await this.processOCRResult(ocrResult, freeAPI.type);
        await this.openResultPage({
          image: imageData,
          text: processedResult,
          videoInfo: videoInfo,
          apiUsed: freeAPI.type,
          timestamp: Date.now()
        });
        sendResponse({ success: true });
        return;
      }

      // 调用OCR服务
      const ocrResult = await this.callOCRService(selectedAPI, imageData);
      
      // 处理识别结果
      const processedResult = await this.processOCRResult(ocrResult, selectedAPI.type);
      
      // 打开结果页面
      await this.openResultPage({
        image: imageData,
        text: processedResult,
        videoInfo: videoInfo,
        apiUsed: selectedAPI.type,
        timestamp: Date.now()
      });

      sendResponse({ success: true });

    } catch (error) {
      console.error('Capture and extract error:', error);
      
      // 尝试使用OCR.space免费版本作为备选
      if (!error.message.includes('OCR.space')) {
        try {
          console.log('Trying OCR.space as fallback...');
          const freeAPI = { type: 'ocrSpace', apiKey: 'helloworld' };
          const ocrResult = await this.callOCRService(freeAPI, request.imageData);
          const processedResult = await this.processOCRResult(ocrResult, freeAPI.type);
          await this.openResultPage({
            image: request.imageData,
            text: processedResult,
            videoInfo: request.videoInfo,
            apiUsed: freeAPI.type,
            timestamp: Date.now()
          });
          sendResponse({ success: true });
          return;
        } catch (fallbackError) {
          console.error('Fallback OCR also failed:', fallbackError);
        }
      }
      
      sendResponse({ error: error.message });
    }
  }

  async getAPIConfig() {
    const result = await chrome.storage.local.get(['apiConfig']);
    return result.apiConfig || {
      azure: { enabled: false },
      google: { enabled: false },
      mathpix: { enabled: false },
      ocrSpace: { enabled: true } // 默认启用免费的OCR.space
    };
  }

  async saveAPIConfig(config) {
    await chrome.storage.local.set({ apiConfig: config });
  }

  selectBestAPI(apiConfig, videoInfo) {
    // API优先级策略
    const priorities = [
      { type: 'azure', config: apiConfig.azure, weight: 3 },
      { type: 'google', config: apiConfig.google, weight: 2 },
      { type: 'mathpix', config: apiConfig.mathpix, weight: 1 }, // 数学公式专用
      { type: 'ocrSpace', config: apiConfig.ocrSpace, weight: 1 }
    ];

    // 如果检测到数学内容，优先使用Mathpix
    if (videoInfo.hasMathContent && apiConfig.mathpix?.enabled && apiConfig.mathpix?.appId) {
      return { type: 'mathpix', ...apiConfig.mathpix };
    }

    // 选择已启用的最高优先级API
    for (const api of priorities) {
      if (api.config.enabled) {
        // OCR.space不需要密钥，其他API需要
        if (api.type === 'ocrSpace' || (api.config.apiKey || (api.config.appId && api.config.appKey))) {
          return { type: api.type, ...api.config };
        }
      }
    }

    return null;
  }

  async callOCRService(apiConfig, imageData) {
    switch (apiConfig.type) {
      case 'azure':
        return this.callAzureVision(apiConfig, imageData);
      case 'google':
        return this.callGoogleVision(apiConfig, imageData);
      case 'mathpix':
        return this.callMathpix(apiConfig, imageData);
      case 'ocrSpace':
        return this.callOCRSpace(apiConfig, imageData);
      default:
        throw new Error(`Unsupported API type: ${apiConfig.type}`);
    }
  }

  async callAzureVision(config, imageData) {
    const response = await fetch('https://vision.cognitiveservices.azure.com/vision/v3.2/read/analyze', {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': config.apiKey,
        'Content-Type': 'application/octet-stream'
      },
      body: this.dataURLtoBlob(imageData)
    });

    if (!response.ok) {
      throw new Error(`Azure Vision API error: ${response.status}`);
    }

    const operationUrl = response.headers.get('Operation-Location');
    return this.pollForResult(operationUrl, config.apiKey);
  }

  async callGoogleVision(config, imageData) {
    const apiKey = config.apiKey;
    const base64Image = imageData.split(',')[1];

    const response = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [{
          image: { content: base64Image },
          features: [
            { type: 'DOCUMENT_TEXT_DETECTION', maxResults: 10 }
          ]
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Google Vision API error: ${response.status}`);
    }

    const result = await response.json();
    return this.parseGoogleVisionResult(result);
  }

  async callMathpix(config, imageData) {
    const response = await fetch('https://api.mathpix.com/v3/text', {
      method: 'POST',
      headers: {
        'app_id': config.appId,
        'app_key': config.appKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        src: imageData,
        formats: ['text', 'latex_styled']
      })
    });

    if (!response.ok) {
      throw new Error(`Mathpix API error: ${response.status}`);
    }

    return response.json();
  }

  async callOCRSpace(config, imageData) {
    try {
      const formData = new FormData();
      formData.append('file', this.dataURLtoBlob(imageData), 'image.png');
      formData.append('language', 'chs'); // 中文识别
      formData.append('isOverlayRequired', 'false');
      formData.append('detectOrientation', 'true');
      formData.append('scale', 'true');
      formData.append('OCREngine', '2'); // 使用引擎2

      // 使用提供的API密钥或默认免费密钥
      const apiKey = config.apiKey || 'helloworld';
      
      const response = await fetch(`https://api.ocr.space/parse/image?apikey=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OCR.space API error details:', errorText);
        throw new Error(`OCR.space API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      
      if (result.IsErroredOnProcessing) {
        throw new Error(`OCR.space processing error: ${result.ErrorMessage || result.ErrorMessage[0]}`);
      }

      if (!result.ParsedResults || result.ParsedResults.length === 0) {
        throw new Error('OCR.space: No text detected in image');
      }

      return {
        text: result.ParsedResults[0].ParsedText || '',
        confidence: result.ParsedResults[0].TextOrientation || 0.8,
        processingTime: result.ProcessingTimeInMilliseconds || 0
      };
    } catch (error) {
      console.error('OCR.space call error:', error);
      throw error;
    }
  }

  async pollForResult(operationUrl, apiKey) {
    // 轮询Azure操作结果
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const response = await fetch(operationUrl, {
        headers: {
          'Ocp-Apim-Subscription-Key': apiKey
        }
      });

      const result = await response.json();
      
      if (result.status === 'succeeded') {
        return this.parseAzureVisionResult(result);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    throw new Error('OCR operation timeout');
  }

  parseGoogleVisionResult(result) {
    const textAnnotations = result.responses[0]?.textAnnotations || [];
    const fullText = textAnnotations[0]?.description || '';
    
    return {
      text: fullText,
      confidence: 0.95, // Google Vision不直接提供置信度
      words: textAnnotations.slice(1).map(annotation => ({
        text: annotation.description,
        boundingBox: annotation.boundingPoly.vertices
      }))
    };
  }

  parseAzureVisionResult(result) {
    const lines = result.analyzeResult.readResults[0]?.lines || [];
    const fullText = lines.map(line => line.text).join('\n');
    
    return {
      text: fullText,
      confidence: 0.9,
      lines: lines.map(line => ({
        text: line.text,
        boundingBox: line.boundingBox,
        words: line.words
      }))
    };
  }

  async processOCRResult(ocrResult, apiType) {
    let processedText = ocrResult.text;

    // 根据API类型进行特定处理
    switch (apiType) {
      case 'mathpix':
        // Mathpix返回的LaTeX格式需要特殊处理
        processedText = this.processMathFormula(ocrResult);
        break;
      
      default:
        // 通用格式优化
        processedText = this.optimizeTextFormat(ocrResult.text);
    }

    return {
      raw: ocrResult.text,
      formatted: processedText,
      confidence: ocrResult.confidence || 0.9,
      apiType: apiType,
      metadata: ocrResult
    };
  }

  processMathFormula(mathpixResult) {
    // 处理Mathpix返回的数学公式
    if (mathpixResult.latex_styled) {
      return {
        text: mathpixResult.text,
        latex: mathpixResult.latex_styled,
        isMath: true
      };
    }
    return { text: mathpixResult.text, isMath: false };
  }

  optimizeTextFormat(text) {
    // 通用文本格式优化
    return text
      // 修复常见OCR错误
      .replace(/\[l/g, '[')     // 左方括号
      .replace(/\]l/g, ']')     // 右方括号
      .replace(/，/g, ',')      // 中文逗号
      .replace(/。/g, '.')      // 中文句号
      // 上标下标转换
      .replace(/\^2/g, '²')
      .replace(/\^3/g, '³')
      // 化学式优化
      .replace(/H2O/g, 'H₂O')
      .replace(/CO2/g, 'CO₂')
      // 清理多余空格
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  async openResultPage(data) {
    try {
      // 生成会话ID
      const sessionId = Date.now().toString();
      
      // 保存数据到本地存储
      await chrome.storage.local.set({
        [`session_${sessionId}`]: data
      });

      // 打开结果页面
      await chrome.tabs.create({
        url: chrome.runtime.getURL(`result/result.html?session=${sessionId}`)
      });
      
      console.log('Result page opened successfully');
    } catch (error) {
      console.error('Failed to open result page:', error);
      throw new Error(`无法打开结果页面: ${error.message}`);
    }
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

  handleInstall(details) {
    if (details.reason === 'install') {
      // 首次安装，打开设置页面
      chrome.tabs.create({
        url: chrome.runtime.getURL('options/options.html?firstInstall=true')
      });
    }
  }
}

// 初始化后台服务
new BackgroundService();
