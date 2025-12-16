// Popup script for Video Text Extractor

class PopupManager {
  constructor() {
    this.currentTab = null;
    this.apiConfig = null;
    this.stats = null;
    this.init();
  }

  async init() {
    try {
      // 获取当前标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tabs[0];

      // 加载配置和统计
      await this.loadConfig();
      await this.loadStats();

      // 绑定事件
      this.bindEvents();

      // 更新UI状态
      await this.updateStatus();
      this.updateAPIStatus();
      this.updateStats();
    } catch (error) {
      console.error('Popup init error:', error);
      this.showNotification('初始化失败，请重试', 'error');
    }
  }

  async loadConfig() {
    const result = await chrome.storage.local.get(['apiConfig']);
    this.apiConfig = result.apiConfig || {
      azure: { enabled: false },
      google: { enabled: false },
      mathpix: { enabled: false },
      ocrSpace: { enabled: true }
    };
  }

  async loadStats() {
    const result = await chrome.storage.local.get(['usageStats']);
    this.stats = result.usageStats || {
      today: 0,
      total: 0,
      lastResetDate: new Date().toDateString()
    };

    // 检查是否需要重置今日统计
    const today = new Date().toDateString();
    if (this.stats.lastResetDate !== today) {
      this.stats.today = 0;
      this.stats.lastResetDate = today;
      await this.saveStats();
    }
  }

  async saveStats() {
    await chrome.storage.local.set({ usageStats: this.stats });
  }

  bindEvents() {
    // 提取按钮
    const extractBtn = document.getElementById('extractBtn');
    if (extractBtn) {
      extractBtn.addEventListener('click', () => {
        this.handleExtract();
      });
    }

    // 设置按钮
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        this.openSettings();
      });
    }

    // 历史记录按钮
    const historyBtn = document.getElementById('historyBtn');
    if (historyBtn) {
      historyBtn.addEventListener('click', () => {
        this.openHistory();
      });
    }

    // 快速操作按钮
    const tutorialBtn = document.getElementById('tutorialBtn');
    if (tutorialBtn) {
      tutorialBtn.addEventListener('click', () => {
        this.openTutorial();
      });
    }

    const feedbackBtn = document.getElementById('feedbackBtn');
    if (feedbackBtn) {
      feedbackBtn.addEventListener('click', () => {
        this.openFeedback();
      });
    }

    const helpBtn = document.getElementById('helpBtn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        this.openHelp();
      });
    }
  }

  async updateStatus() {
    try {
      // 检查当前页面是否有视频
      const results = await chrome.scripting.executeScript({
        target: { tabId: this.currentTab.id },
        func: () => {
          return document.querySelectorAll('video').length > 0;
        }
      });

      const hasVideo = results[0]?.result || false;
      const statusDot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');
      const extractBtn = document.getElementById('extractBtn');

      if (statusDot && statusText && extractBtn) {
        if (hasVideo) {
          statusDot.className = 'status-dot';
          statusText.textContent = '检测到视频元素';
          extractBtn.disabled = false;
        } else {
          statusDot.className = 'status-dot error';
          statusText.textContent = '未检测到视频元素';
          extractBtn.disabled = true;
        }
      }

    } catch (error) {
      console.error('Status update error:', error);
      const statusDot = document.getElementById('statusDot');
      const statusText = document.getElementById('statusText');
      
      if (statusDot && statusText) {
        statusDot.className = 'status-dot error';
        statusText.textContent = '无法检查页面状态';
      }
    }
  }

  updateAPIStatus() {
    // 更新API状态指示器
    this.updateAPIDot('azure', this.apiConfig.azure.enabled);
    this.updateAPIDot('google', this.apiConfig.google.enabled);
    this.updateAPIDot('mathpix', this.apiConfig.mathpix.enabled);
    this.updateAPIDot('ocrSpace', this.apiConfig.ocrSpace.enabled);
  }

  updateAPIDot(apiName, enabled) {
    const dot = document.getElementById(`${apiName}Dot`);
    if (dot) {
      dot.className = enabled ? 'api-dot' : 'api-dot inactive';
    }
  }

  updateStats() {
    const todayCount = document.getElementById('todayCount');
    const totalCount = document.getElementById('totalCount');
    
    if (todayCount) todayCount.textContent = this.stats.today;
    if (totalCount) totalCount.textContent = this.stats.total;
  }

  async handleExtract() {
    try {
      this.showLoading(true);
      
      // 首先检查content script是否已注入
      let contentScriptReady = false;
      try {
        const response = await chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'ping'
        });
        contentScriptReady = response && response.status === 'ready';
      } catch (error) {
        console.log('Content script not ready, injecting...');
      }

      // 如果content script未就绪，先注入
      if (!contentScriptReady) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: this.currentTab.id },
            files: ['content.js']
          });
          
          // 等待content script初始化
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (injectError) {
          console.error('Failed to inject content script:', injectError);
          this.showNotification('无法注入内容脚本，请刷新页面后重试', 'error');
          this.showLoading(false);
          return;
        }
      }

      // 发送提取消息
      try {
        await chrome.tabs.sendMessage(this.currentTab.id, {
          action: 'activateExtraction'
        });
      } catch (messageError) {
        console.error('Failed to send message:', messageError);
        this.showNotification('无法与页面通信，请刷新页面后重试', 'error');
        this.showLoading(false);
        return;
      }

      // 更新统计
      this.stats.today++;
      this.stats.total++;
      await this.saveStats();
      this.updateStats();

      // 显示成功消息
      this.showNotification('文本提取已启动', 'success');

      // 延迟关闭popup
      setTimeout(() => {
        window.close();
      }, 1500);

    } catch (error) {
      console.error('Extract error:', error);
      this.showNotification('提取失败：' + error.message, 'error');
      this.showLoading(false);
    }
  }

  openSettings() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('options/options.html')
    });
    window.close();
  }

  openHistory() {
    chrome.tabs.create({
      url: chrome.runtime.getURL('result/history.html')
    });
    window.close();
  }

  openTutorial() {
    chrome.tabs.create({
      url: 'https://github.com/your-repo/video-text-extractor/wiki'
    });
    window.close();
  }

  openFeedback() {
    chrome.tabs.create({
      url: 'https://github.com/your-repo/video-text-extractor/issues'
    });
  }

  openHelp() {
    chrome.tabs.create({
      url: 'https://github.com/your-repo/video-text-extractor/wiki/Getting-Started'
    });
  }

  showLoading(show) {
    const loading = document.getElementById('loading');
    const mainContent = document.querySelector('.main-content');
    
    if (loading && mainContent) {
      if (show) {
        loading.classList.add('show');
        mainContent.style.opacity = '0.5';
        mainContent.style.pointerEvents = 'none';
      } else {
        loading.classList.remove('show');
        mainContent.style.opacity = '1';
        mainContent.style.pointerEvents = 'auto';
      }
    }
  }

  showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    
    if (notification) {
      notification.textContent = message;
      notification.className = 'notification show';
      
      // 设置背景色
      if (type === 'error') {
        notification.style.background = '#dc3545';
      } else if (type === 'success') {
        notification.style.background = '#28a745';
      } else if (type === 'warning') {
        notification.style.background = '#ffc107';
        notification.style.color = '#212529';
      } else {
        notification.style.background = '#333';
        notification.style.color = 'white';
      }

      // 3秒后隐藏
      setTimeout(() => {
        notification.classList.remove('show');
      }, 3000);
    }
  }

  // 检查API配置完整性
  checkAPIConfig() {
    const configuredAPIs = [];
    
    if (this.apiConfig.azure?.apiKey) {
      configuredAPIs.push('Azure');
    }
    if (this.apiConfig.google?.apiKey) {
      configuredAPIs.push('Google');
    }
    if (this.apiConfig.mathpix?.appId && this.apiConfig.mathpix?.appKey) {
      configuredAPIs.push('Mathpix');
    }
    
    // OCR.space总是可用（免费API）
    configuredAPIs.push('OCR.space');

    return configuredAPIs;
  }

  // 获取推荐的API配置
  getRecommendedAPI() {
    if (this.apiConfig.azure?.enabled && this.apiConfig.azure?.apiKey) {
      return 'Azure Vision';
    }
    if (this.apiConfig.google?.enabled && this.apiConfig.google?.apiKey) {
      return 'Google Vision';
    }
    if (this.apiConfig.mathpix?.enabled && this.apiConfig.mathpix?.appId) {
      return 'Mathpix';
    }
    return 'OCR.space (免费)';
  }

  // 显示首次使用提示
  showFirstTimeTips() {
    const firstTime = localStorage.getItem('vte-first-time');
    if (!firstTime) {
      setTimeout(() => {
        this.showNotification('首次使用？建议先配置OCR API以获得更好效果！', 'info');
        localStorage.setItem('vte-first-time', 'true');
      }, 1000);
    }
  }

  // 检查浏览器兼容性
  checkCompatibility() {
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isEdge = /Edg/.test(navigator.userAgent);
    
    if (!isChrome && !isEdge) {
      this.showNotification('建议使用Chrome或Edge浏览器以获得最佳体验', 'warning');
    }
  }

  // 键盘快捷键支持
  addKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      const extractBtn = document.getElementById('extractBtn');
      
      // Enter键触发提取
      if (e.key === 'Enter' && extractBtn && !extractBtn.disabled) {
        this.handleExtract();
      }
      
      // Esc键关闭popup
      if (e.key === 'Escape') {
        window.close();
      }
      
      // Ctrl+, 打开设置
      if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        this.openSettings();
      }
    });
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', async () => {
  try {
    const popup = new PopupManager();
    
    // 显示首次使用提示
    popup.showFirstTimeTips();
    
    // 检查浏览器兼容性
    popup.checkCompatibility();
    
    // 添加键盘快捷键
    popup.addKeyboardShortcuts();
    
    // 调试信息（移除process.env引用）
    if (false) { // 手动控制调试模式
      console.log('Popup initialized', {
        apiConfig: popup.apiConfig,
        stats: popup.stats
      });
    }
  } catch (error) {
    console.error('Popup initialization failed:', error);
  }
});

// 防止popup被意外关闭
window.addEventListener('beforeunload', (e) => {
  // 如果正在处理，提示用户
  const loading = document.getElementById('loading');
  if (loading && loading.classList.contains('show')) {
    e.preventDefault();
    e.returnValue = '';
  }
});
