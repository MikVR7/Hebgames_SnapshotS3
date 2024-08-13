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
            const cameras = await this.cameraManager.listCameras();
            if (cameras.length === 0) {
                throw new Error('No cameras found');
            }

            // Create a select element for camera selection
            const select = document.createElement('select');
            select.id = 'camera-select';
            cameras.forEach((camera, index) => {
                const option = document.createElement('option');
                option.value = camera.deviceId;
                option.text = camera.label || `Camera ${index + 1}`;
                select.appendChild(option);
            });

            // Add the select element to the page
            const appContainer = document.getElementById('app-container');
            appContainer?.insertBefore(select, appContainer.firstChild);

            // Initialize with the first camera
            await this.cameraManager.initCamera(cameras[0].deviceId);

            // Add event listener for camera selection
            select.addEventListener('change', async (event) => {
                const target = event.target as HTMLSelectElement;
                await this.cameraManager.initCamera(target.value);
            });

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
            const imageUrl = await this.imageUploader.uploadImage(imageBlob);
            this.showMessage(`Image captured and uploaded successfully! URL: ${imageUrl}`, 'success');
            console.log('Uploaded image URL:', imageUrl);
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