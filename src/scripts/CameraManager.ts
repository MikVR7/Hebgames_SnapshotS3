export class CameraManager {
    private videoElement: HTMLVideoElement;
    private canvasElement: HTMLCanvasElement;
    private stream: MediaStream | null = null;

    constructor(videoElementId: string, canvasElementId: string) {
        this.videoElement = document.getElementById(videoElementId) as HTMLVideoElement;
        this.canvasElement = document.getElementById(canvasElementId) as HTMLCanvasElement;
    }

    public async listCameras(): Promise<MediaDeviceInfo[]> {
        const devices = await navigator.mediaDevices.enumerateDevices();
        return devices.filter(device => device.kind === 'videoinput');
    }

    public async initCamera(deviceId?: string): Promise<void> {
        try {
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }

            const constraints: MediaStreamConstraints = {
                video: deviceId
                    ? { deviceId: { exact: deviceId } }
                    : { facingMode: 'environment', width: { ideal: 4096 }, height: { ideal: 2160 } }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.videoElement.srcObject = this.stream;
            await new Promise<void>((resolve) => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve();
                };
            });
        } catch (error) {
            console.error('Error accessing camera:', error);
            throw error;
        }
    }

    public captureImage(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            const { videoWidth, videoHeight } = this.videoElement;
            this.canvasElement.width = videoWidth;
            this.canvasElement.height = videoHeight;
            const context = this.canvasElement.getContext('2d');
            
            if (context) {
                context.drawImage(this.videoElement, 0, 0, videoWidth, videoHeight);
                this.canvasElement.toBlob(blob => {
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error('Failed to create image blob'));
                    }
                }, 'image/jpeg', 0.95);
            } else {
                reject(new Error('Failed to get canvas context'));
            }
        });
    }
}