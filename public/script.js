// Language translations
const translations = {
    en: {
        title: 'AI Image Generator',
        description: 'Dream it up, then add it to your design. Watch your words and phrases transform into beautiful images with the best AI image generators available at your fingertips.',
        promptPlaceholder: 'Describe the image you want to create...',
        styles: {
            photo: 'Photo',
            vibrant: 'Vibrant',
            concept: 'Concept',
            dreamy: 'Dreamy'
        },
        settings: {
            resolution: 'Image Resolution',
            count: 'Image Count'
        },
        auth: {
            signIn: 'Sign In',
            signUp: 'Sign Up'
        }
    },
    zh: {
        title: 'AI 图像生成器',
        description: '想象它，然后将其添加到您的设计中。观看您的文字和短语通过最好的 AI 图像生成器转变为美丽的图像。',
        promptPlaceholder: '描述您想要创建的图像...',
        styles: {
            photo: '照片',
            vibrant: '鲜艳',
            concept: '概念',
            dreamy: '梦幻'
        },
        settings: {
            resolution: '图像分辨率',
            count: '图像数量'
        },
        auth: {
            signIn: '登录',
            signUp: '注册'
        }
    }
};

// DOM Elements
const languageSelect = document.getElementById('languageSelect');
const promptInput = document.getElementById('promptInput');
const styleButtons = document.querySelectorAll('.style-btn');

// Language switching
function updateLanguage(lang) {
    document.querySelectorAll('[data-en]').forEach(element => {
        const text = element.getAttribute(`data-${lang}`);
        if (text) {
            element.textContent = text;
        }
    });

    // Update input placeholder
    if (promptInput) {
        promptInput.placeholder = promptInput.getAttribute(`data-placeholder-${lang}`);
    }

    // Update select options
    document.querySelectorAll('option[data-en]').forEach(option => {
        const text = option.getAttribute(`data-${lang}`);
        if (text) {
            option.textContent = text;
        }
    });
}

// Style button handling
styleButtons.forEach(button => {
    button.addEventListener('click', () => {
        styleButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
    });
});

// Event listeners
languageSelect.addEventListener('change', (e) => {
    updateLanguage(e.target.value);
});

// Initialize with default language
updateLanguage('en');