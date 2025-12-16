// Content script for Video Text Extractor

class VideoTextExtractor {
  constructor() {
    this.videos = [];
    this.isActive = false;
    this.currentVideo = null;
    this.init();
  }

  init() {
    // 监听来自background和popup的消息
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse);
      return true;
    });

    // 监听页面变化，动态检测视频
    this.observePageChanges();
    
    // 初始检测页面中的视频
    this.detectVideos();
    
    // 添加键盘快捷键支持
    this.addKeyboardShortcuts();
  }

  handleMessage(request, sender, sendResponse) {
    switch (request.action) {
      case 'ping':
        // 响应ping消息，表示content script已就绪
        sendResponse({ status: 'ready' });
        break;
        
      case 'activateExtraction':
        this.activateExtraction();
        sendResponse({ success: true });
        break;
      
      case 'showNotification':
        this.showNotification(request.message);
        sendResponse({ success: true });
        break;
      
      default:
        sendResponse({ error: 'Unknown action' });
    }
  }

  activateExtraction() {
    if (this.videos.length === 0) {
      this.showNotification('当前页面未检测到视频元素');
      return;
    }

    // 如果有多个视频，让用户选择
    if (this.videos.length > 1) {
      this.showVideoSelector();
    } else {
      this.processVideo(this.videos[0]);
    }
  }

  detectVideos() {
    this.videos = Array.from(document.querySelectorAll('video'));
    console.log(`Detected ${this.videos.length} video(s)`);
    
    // 为每个视频添加事件监听器
    this.videos.forEach((video, index) => {
      video.dataset.videoIndex = index;
      this.addVideoEventListeners(video);
    });
  }

  addVideoEventListeners(video) {
    // 监听暂停事件
    video.addEventListener('pause', () => {
      if (this.isActive) {
        console.log('Video paused, ready for extraction');
      }
    });

    // 监听播放事件
    video.addEventListener('play', () => {
      console.log('Video started playing');
    });

    // 监听加载完成事件
    video.addEventListener('loadeddata', () => {
      console.log('Video data loaded');
    });
  }

  observePageChanges() {
    // 监听DOM变化，检测新加载的视频
    const observer = new MutationObserver((mutations) => {
      let hasNewVideos = false;
      
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeName === 'VIDEO' || 
              (node.nodeName === 'DIV' && node.querySelector('video'))) {
            hasNewVideos = true;
          }
        });
      });

      if (hasNewVideos) {
        setTimeout(() => this.detectVideos(), 1000);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  showVideoSelector() {
    // 创建视频选择界面
    const selector = document.createElement('div');
    selector.id = 'video-text-extractor-selector';
    selector.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      border: 2px solid #007acc;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      min-width: 300px;
    `;

    selector.innerHTML = `
      <h3 style="margin-top: 0; color: #007acc;">选择要处理的视频</h3>
      <div id="video-list"></div>
      <div style="margin-top: 15px; text-align: right;">
        <button id="cancel-selection" style="
          background: #ccc;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          margin-right: 10px;
        ">取消</button>
      </div>
    `;

    // 添加视频列表
    const videoList = selector.querySelector('#video-list');
    this.videos.forEach((video, index) => {
      const videoItem = document.createElement('div');
      videoItem.style.cssText = `
        padding: 10px;
        margin: 5px 0;
        border: 1px solid #ddd;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.2s;
      `;
      
      const videoTitle = video.title || `视频 ${index + 1}`;
      const videoSrc = video.src || video.currentSrc;
      const domain = videoSrc ? new URL(videoSrc, window.location.href).hostname : '本地视频';
      
      videoItem.innerHTML = `
        <div style="font-weight: bold;">${videoTitle}</div>
        <div style="font-size: 12px; color: #666;">${domain}</div>
        <div style="font-size: 12px; color: #666;">
          ${video.videoWidth}×${video.videoHeight} | 
          ${this.formatDuration(video.duration)}
        </div>
      `;

      videoItem.addEventListener('mouseenter', () => {
        videoItem.style.background = '#f0f8ff';
      });

      videoItem.addEventListener('mouseleave', () => {
        videoItem.style.background = 'white';
      });

      videoItem.addEventListener('click', () => {
        document.body.removeChild(selector);
        this.processVideo(video);
      });

      videoList.appendChild(videoItem);
    });

    // 添加取消按钮事件
    selector.querySelector('#cancel-selection').addEventListener('click', () => {
      document.body.removeChild(selector);
    });

    // 添加到页面
    document.body.appendChild(selector);
  }

  formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '未知长度';
    
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  async processVideo(video) {
    this.currentVideo = video;
    this.isActive = true;

    try {
      // 显示处理提示
      this.showProcessingIndicator();

      // 暂停视频（如果正在播放）
      if (!video.paused) {
        video.pause();
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // 捕获视频帧
      const imageData = await this.captureVideoFrame(video);
      
      // 获取视频信息
      const videoInfo = this.getVideoInfo(video);

      // 发送到background进行OCR处理
      chrome.runtime.sendMessage({
        action: 'captureAndExtract',
        imageData: imageData,
        videoInfo: videoInfo
      }, (response) => {
        this.hideProcessingIndicator();
        
        if (response.error) {
          this.showNotification(`处理失败: ${response.error}`);
        }
      });

    } catch (error) {
      this.hideProcessingIndicator();
      console.error('Video processing error:', error);
      this.showNotification(`处理失败: ${error.message}`);
    }
  }

  async captureVideoFrame(video) {
    return new Promise((resolve, reject) => {
      try {
        // 创建canvas
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');

        // 绘制视频帧
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // 转换为data URL
        const dataURL = canvas.toDataURL('image/png', 0.9);
        resolve(dataURL);

      } catch (error) {
        reject(error);
      }
    });
  }

  getVideoInfo(video) {
    // 分析视频内容，检测是否包含数学内容
    const hasMathContent = this.detectMathContent(video);
    
    return {
      src: video.src || video.currentSrc,
      title: video.title || document.title,
      dimensions: {
        width: video.videoWidth,
        height: video.videoHeight
      },
      duration: video.duration,
      currentTime: video.currentTime,
      hasMathContent: hasMathContent,
      pageUrl: window.location.href,
      pageTitle: document.title
    };
  }

  detectMathContent(video) {
    // 基于页面内容检测是否可能包含数学公式
    const pageText = document.body.innerText.toLowerCase();
    const mathKeywords = [
      'formula', 'equation', 'integral', 'derivative',
      '公式', '方程', '积分', '导数', '∫', '∑', '∂'
    ];
    
    return mathKeywords.some(keyword => pageText.includes(keyword));
  }

  showProcessingIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'video-text-extractor-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #007acc;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
    `;

    indicator.innerHTML = `
      <div style="
        width: 20px;
        height: 20px;
        border: 2px solid white;
        border-top: 2px solid transparent;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <span>正在识别文本...</span>
    `;

    // 添加旋转动画
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(indicator);
  }

  hideProcessingIndicator() {
    const indicator = document.getElementById('video-text-extractor-indicator');
    if (indicator) {
      document.body.removeChild(indicator);
    }
  }

  showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #333;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 14px;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    // 淡入效果
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);

    // 3秒后自动消失
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  // 添加快捷键支持
  addKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+Shift+V 激活提取
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        this.activateExtraction();
      }
    });
  }
}

// 初始化内容脚本
new VideoTextExtractor();

// 向background script发送就绪消息
chrome.runtime.sendMessage({ action: 'contentScriptReady' });
