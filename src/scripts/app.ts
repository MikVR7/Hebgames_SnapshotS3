import { CameraManager } from './CameraManager.js';
import { ImageUploader } from './ImageUploader.js';

class App {
    private cameraManager: CameraManager;
    private imageUploader: ImageUploader;
    private captureButton: HTMLButtonElement;
    private messageDiv: HTMLDivElement;

    constructor() {
        this.cameraManager = new CameraManager('camera-feed', 'capture-canvas');
        this.imageUploader = new ImageUploader();
        this.captureButton = document.getElementById('capture-button') as HTMLButtonElement;
        this.messageDiv = document.getElementById('message') as HTMLDivElement;
        this.init();
    }

    private async init(): Promise<void> {
        try {
            await this.cameraManager.initCamera();
            this.captureButton.addEventListener('click', this.handleCapture.bind(this));
            this.captureButton.disabled = false;
        } catch (error) {
            console.error('Error initializing camera:', error);
            this.showMessage('Failed to initialize camera. Please check your camera permissions.', 'error');
        }
    }

    private async handleCapture(): Promise<void> {
        this.showMessage('Capturing and uploading image...', 'info');

        try {
            const imageBlob = await this.cameraManager.captureImage();
            await this.imageUploader.uploadImage(imageBlob);
            this.showMessage('Image captured and uploaded successfully!', 'success');
        } catch (error: unknown) {
            console.error('Error capturing or uploading image:', error);
            if (error instanceof Error) {
                this.showMessage(`Failed to capture or upload image: ${error.message}`, 'error');
            } else {
                this.showMessage('Failed to capture or upload image: An unknown error occurred', 'error');
            }
        }
    }

    private showMessage(message: string, type: 'info' | 'success' | 'error'): void {
        this.messageDiv.textContent = message;
        this.messageDiv.className = `message ${type}`;
        this.messageDiv.style.display = 'block';

        // Hide the message after 5 seconds
        setTimeout(() => {
            this.messageDiv.style.display = 'none';
        }, 5000);
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});