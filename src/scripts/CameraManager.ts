export class CameraManager {
    private videoElement: HTMLVideoElement;
    private canvasElement: HTMLCanvasElement;

    constructor(videoElementId: string, canvasElementId: string) {
        this.videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
        this.canvasElement = document.getElementById(canvasElementId) as HTMLCanvasElement;
    }

    public async initCamera(): Promise<void> {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
            this.videoElement.srcObject = stream;
        } catch (error) {
            console.error('Error accessing camera:', error);
        }
    }

    public captureImage(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            this.canvasElement.width = this.videoElement.videoWidth;
            this.canvasElement.height = this.videoElement.videoHeight;
            const context = this.canvasElement.getContext('2d');
            
            if (context) {
                context.drawImage(this.videoElement, 0, 0);
                this.canvasElement.toBlob(blob => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create image blob'));
                    }
                }, 'image/jpeg');
            } else {
                reject(new Error('Failed to get canvas context'));
            }
        });
    }
}