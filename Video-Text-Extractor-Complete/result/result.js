// Result page script for Video Text Extractor

class ResultPage {
  constructor() {
    this.sessionId = null;
    this.data = null;
    this.currentZoom = 1;
    this.isEditing = false;
    this.isFormatted = false;
    this.originalText = '';
    this.formattedText = '';
    
    this.init();
  }

  async init() {
    try {
      // 获取会话ID
      this.sessionId = this.getSessionId();
      
      if (!this.sessionId) {
        this.showError('缺少会话参数，请重新提取');
        return;
      }

      // 加载数据
      await this.loadData();
      
      // 显示内容
      this.displayImage();
      this.displayText();
      this.updateMetadata();
      
      // 绑定事件
      this.bindEvents();
      
      // 更新统计
      this.updateStats();
      
    } catch (error) {
      console.error('Result page init error:', error);
      this.showError('加载结果失败：' + error.message);
    }
  }

  getSessionId() {
    const params = new URLSearchParams(window.location.search);
    return params.get('session');
  }

  async loadData() {
    const result = await chrome.storage.local.get([`session_${this.sessionId}`]);
    this.data = result[`session_${this.sessionId}`];
    
    if (!this.data) {
      throw new Error('会话数据不存在或已过期');
    }

    // 清理过期的会话数据
    this.cleanupExpiredSessions();
  }

  displayImage() {
    const img = document.getElementById('videoFrame');
    img.src = this.data.image;
    
    img.onload = () => {
      // 更新分辨率信息
      document.getElementById('resolution').textContent = 
        `${img.naturalWidth}×${img.naturalHeight}`;
    };

    img.onerror = () => {
      console.error('Failed to load image');
      this.showNotification('图片加载失败', 'error');
    };
  }

  displayText() {
    const textarea = document.getElementById('textContent');
    const textData = this.data.text;
    
    // 保存原始文本
    this.originalText = textData.raw || textData.text || '';
    
    // 应用格式化
    if (document.getElementById('formatToggle').checked) {
      this.formattedText = this.applySmartFormatting(this.originalText);
      textarea.value = this.formattedText;
      this.isFormatted = true;
    } else {
      textarea.value = this.originalText;
      this.isFormatted = false;
    }

    // 更新字符统计
    this.updateCharCount();
    
    // 更新置信度
    this.updateConfidence(textData.confidence || 0.9);
  }

  updateMetadata() {
    // 提取时间
    const extractTime = new Date(this.data.timestamp).toLocaleString('zh-CN');
    document.getElementById('extractTime').textContent = extractTime;
    
    // 使用的API
    const apiNames = {
      'azure': 'Azure Vision',
      'google': 'Google Vision',
      'mathpix': 'Mathpix',
      'ocrSpace': 'OCR.space'
    };
    document.getElementById('apiUsed').textContent = 
      apiNames[this.data.apiUsed] || this.data.apiUsed;
    
    // 来源页面
    const videoInfo = this.data.videoInfo || {};
    const sourcePage = videoInfo.pageTitle || videoInfo.title || '未知页面';
    document.getElementById('sourcePage').textContent = sourcePage;
  }

  bindEvents() {
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'c':
            if (e.shiftKey) {
              e.preventDefault();
              this.copyAllText();
            }
            break;
          case 's':
            e.preventDefault();
            this.exportText();
            break;
          case 'f':
            e.preventDefault();
            this.toggleFormat();
            break;
        }
      }
      
      if (e.key === 'Escape' && this.isEditing) {
        this.toggleEdit();
      }
    });

    // 图片加载完成后的缩放控制
    const img = document.getElementById('videoFrame');
    img.addEventListener('wheel', (e) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        this.setZoom(this.currentZoom + delta);
      }
    });
  }

  updateCharCount() {
    const textarea = document.getElementById('textContent');
    const text = textarea.value;
    
    document.getElementById('charCount').textContent = text.length;
    document.getElementById('lineCount').textContent = text.split('\n').length;
  }

  updateConfidence(confidence) {
    const percentage = Math.round(confidence * 100);
    document.getElementById('confidenceFill').style.width = `${percentage}%`;
    document.getElementById('confidenceText').textContent = `${percentage}%`;
    
    // 根据置信度设置颜色
    const fill = document.getElementById('confidenceFill');
    if (percentage >= 80) {
      fill.style.background = 'linear-gradient(90deg, #28a745 0%, #20c997 100%)';
    } else if (percentage >= 60) {
      fill.style.background = 'linear-gradient(90deg, #ffc107 0%, #fd7e14 100%)';
    } else {
      fill.style.background = 'linear-gradient(90deg, #dc3545 0%, #e83e8c 100%)';
    }
  }

  async copyAllText() {
    try {
      const textarea = document.getElementById('textContent');
      const text = textarea.value;
      
      await navigator.clipboard.writeText(text);
      this.showNotification('文本已复制到剪贴板', 'success');
      
    } catch (error) {
      console.error('Copy failed:', error);
      this.fallbackCopy(textarea.value);
    }
  }

  async copySelected() {
    const textarea = document.getElementById('textContent');
    const selectedText = textarea.value.substring(
      textarea.selectionStart,
      textarea.selectionEnd
    );
    
    if (!selectedText) {
      this.showNotification('请先选择要复制的文本', 'warning');
      return;
    }
    
    try {
      await navigator.clipboard.writeText(selectedText);
      this.showNotification('选中文本已复制', 'success');
    } catch (error) {
      this.fallbackCopy(selectedText);
    }
  }

  fallbackCopy(text) {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    
    try {
      document.execCommand('copy');
      this.showNotification('文本已复制', 'success');
    } catch (error) {
      this.showNotification('复制失败，请手动选择复制', 'error');
    }
    
    document.body.removeChild(textarea);
  }

  toggleFormat() {
    const textarea = document.getElementById('textContent');
    const formatToggle = document.getElementById('formatToggle');
    
    if (this.isFormatted) {
      textarea.value = this.originalText;
      this.isFormatted = false;
      formatToggle.checked = false;
    } else {
      this.formattedText = this.applySmartFormatting(this.originalText);
      textarea.value = this.formattedText;
      this.isFormatted = true;
      formatToggle.checked = true;
    }
    
    this.updateCharCount();
  }

  toggleFormatMode() {
    const textarea = document.getElementById('textContent');
    const isChecked = document.getElementById('formatToggle').checked;
    
    if (isChecked) {
      this.formattedText = this.applySmartFormatting(this.originalText);
      textarea.value = this.formattedText;
      this.isFormatted = true;
    } else {
      textarea.value = this.originalText;
      this.isFormatted = false;
    }
    
    this.updateCharCount();
  }

  applySmartFormatting(text) {
    if (!text) return text;
    
    // 数学公式格式化
    text = this.formatMathFormulas(text);
    
    // 代码格式化
    text = this.formatCode(text);
    
    // 化学式格式化
    text = this.formatChemicalFormulas(text);
    
    // 上标下标转换
    text = this.formatSuperscripts(text);
    
    // 标点符号优化
    text = this.optimizePunctuation(text);
    
    // 清理多余空白
    text = this.cleanupWhitespace(text);
    
    return text;
  }

  formatMathFormulas(text) {
    // 数学符号转换
    return text
      .replace(/\\int/g, '∫')
      .replace(/\\sum/g, '∑')
      .replace(/\\prod/g, '∏')
      .replace(/\\sqrt/g, '√')
      .replace(/\\infty/g, '∞')
      .replace(/\\alpha/g, 'α')
      .replace(/\\beta/g, 'β')
      .replace(/\\gamma/g, 'γ')
      .replace(/\\delta/g, 'δ')
      .replace(/\\theta/g, 'θ')
      .replace(/\\lambda/g, 'λ')
      .replace(/\\mu/g, 'μ')
      .replace(/\\pi/g, 'π')
      .replace(/\\sigma/g, 'σ')
      .replace(/\\phi/g, 'φ')
      .replace(/\\omega/g, 'ω');
  }

  formatCode(text) {
    // 代码块格式化
    return text
      // 保留缩进
      .replace(/^(\s+)/gm, (match) => match)
      // 代码关键词高亮（简单版本）
      .replace(/\b(function|var|let|const|if|else|for|while|return|class|extends|import|export)\b/g, 
        '<span style="color: #d73a49;">$1</span>');
  }

  formatChemicalFormulas(text) {
    return text
      .replace(/H2O/g, 'H₂O')
      .replace(/CO2/g, 'CO₂')
      .replace(/SO2/g, 'SO₂')
      .replace(/NO2/g, 'NO₂')
      .replace(/NH3/g, 'NH₃')
      .replace(/CH4/g, 'CH₄')
      .replace(/O2/g, 'O₂')
      .replace(/N2/g, 'N₂');
  }

  formatSuperscripts(text) {
    return text
      .replace(/\^2/g, '²')
      .replace(/\^3/g, '³')
      .replace(/\^([-+]?\d+)/g, (match, num) => {
        const superscripts = '⁰¹²³⁴⁵⁶⁷⁸⁹';
        let result = '';
        for (let char of num) {
          if (char === '-') result += '⁻';
          else if (char === '+') result += '⁺';
          else result += superscripts[parseInt(char)] || char;
        }
        return result;
      })
      .replace(/_(\d+)/g, (match, num) => {
        const subscripts = '₀₁₂₃₄₅₆₇₈₉';
        let result = '';
        for (let char of num) {
          result += subscripts[parseInt(char)] || char;
        }
        return result;
      });
  }

  optimizePunctuation(text) {
    return text
      // 中文标点转英文
      .replace(/，/g, ',')
      .replace(/。/g, '.')
      .replace(/；/g, ';')
      .replace(/：/g, ':')
      .replace(/？/g, '?')
      .replace(/！/g, '!')
      // 修复常见的OCR错误
      .replace(/\[l/g, '[')
      .replace(/\]l/g, ']')
      .replace(/\(\l/g, '(')
      .replace(/\)l/g, ')')
      .replace(/1l/g, '11')
      .replace(/0l/g, '00');
  }

  cleanupWhitespace(text) {
    return text
      // 清理多余的空行
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      // 清理行首行尾空格
      .replace(/^\s+|\s+$/gm, '')
      // 清理多余的空格
      .replace(/ {2,}/g, ' ')
      .trim();
  }

  async exportText() {
    const textarea = document.getElementById('textContent');
    const text = textarea.value;
    
    if (!text.trim()) {
      this.showNotification('没有可导出的文本', 'warning');
      return;
    }

    // 创建下载
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `video-text-${this.sessionId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    this.showNotification('文本已导出', 'success');
  }

  toggleEdit() {
    const textarea = document.getElementById('textContent');
    const editBtn = event.target;
    
    if (this.isEditing) {
      textarea.readOnly = true;
      textarea.style.background = '#f8f9fa';
      editBtn.textContent = '✏️ 编辑';
      editBtn.className = 'btn btn-secondary btn-sm';
      this.isEditing = false;
      
      // 保存编辑后的文本
      this.originalText = textarea.value;
      
    } else {
      textarea.readOnly = false;
      textarea.style.background = 'white';
      editBtn.textContent = '💾 保存';
      editBtn.className = 'btn btn-success btn-sm';
      this.isEditing = true;
      textarea.focus();
    }
  }

  zoomIn() {
    this.setZoom(Math.min(this.currentZoom + 0.2, 3));
  }

  zoomOut() {
    this.setZoom(Math.max(this.currentZoom - 0.2, 0.5));
  }

  resetZoom() {
    this.setZoom(1);
  }

  setZoom(level) {
    this.currentZoom = Math.max(0.5, Math.min(3, level));
    const img = document.getElementById('videoFrame');
    img.style.transform = `scale(${this.currentZoom})`;
  }

  async shareResult() {
    const text = document.getElementById('textContent').value;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: '视频文本提取结果',
          text: text,
          url: window.location.href
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      // 降级到复制链接
      await navigator.clipboard.writeText(window.location.href);
      this.showNotification('链接已复制，可以分享给他人', 'success');
    }
  }

  async saveToHistory() {
    const historyItem = {
      id: this.sessionId,
      timestamp: this.data.timestamp,
      text: this.originalText,
      image: this.data.image,
      apiUsed: this.data.apiUsed,
      videoInfo: this.data.videoInfo,
      confidence: this.data.text.confidence
    };
    
    // 获取现有历史记录
    const result = await chrome.storage.local.get(['extractionHistory']);
    const history = result.extractionHistory || [];
    
    // 添加到历史记录
    history.unshift(historyItem);
    
    // 限制历史记录数量
    if (history.length > 50) {
      history.splice(50);
    }
    
    // 保存历史记录
    await chrome.storage.local.set({ extractionHistory: history });
    
    this.showNotification('已保存到历史记录', 'success');
  }

  async reportError() {
    const text = document.getElementById('textContent').value;
    const subject = encodeURIComponent('视频文本提取错误报告');
    const body = encodeURIComponent(`
错误描述：
${text}

会话信息：
会话ID: ${this.sessionId}
时间: ${new Date().toLocaleString()}
API: ${this.data.apiUsed}
页面: ${this.data.videoInfo?.pageTitle}
    `);
    
    window.open(`mailto:support@example.com?subject=${subject}&body=${body}`);
  }

  extractNew() {
    // 返回原页面进行新的提取
    if (this.data.videoInfo?.pageUrl) {
      chrome.tabs.create({ url: this.data.videoInfo.pageUrl });
    }
    window.close();
  }

  goBack() {
    window.close();
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

  showError(message) {
    const container = document.querySelector('.container');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <h2>加载失败</h2>
        <p>${message}</p>
        <button class="btn btn-primary" onclick="window.close()">关闭页面</button>
      </div>
    `;
  }

  async updateStats() {
    // 更新使用统计
    const result = await chrome.storage.local.get(['usageStats']);
    const stats = result.usageStats || {};
    
    stats.lastExtraction = this.data.timestamp;
    stats.totalApiCalls = (stats.totalApiCalls || 0) + 1;
    
    await chrome.storage.local.set({ usageStats: stats });
  }

  async cleanupExpiredSessions() {
    const result = await chrome.storage.local.get();
    const now = Date.now();
    const expiredTime = 24 * 60 * 60 * 1000; // 24小时
    
    Object.keys(result).forEach(key => {
      if (key.startsWith('session_')) {
        const session = result[key];
        if (session.timestamp && (now - session.timestamp) > expiredTime) {
          chrome.storage.local.remove(key);
        }
      }
    });
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
  new ResultPage();
});

// 防止页面意外关闭
window.addEventListener('beforeunload', (e) => {
  const textarea = document.getElementById('textContent');
  const isEdited = textarea.value !== textarea.defaultValue;
  
  if (isEdited) {
    e.preventDefault();
    e.returnValue = '您有未保存的更改，确定要离开吗？';
  }
});
