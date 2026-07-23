import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Capacitor } from '@capacitor/core';

export async function takePicture() {
  if (!Capacitor.isNativePlatform()) {
    console.log('Camera only available on native platforms');
    return null;
  }

  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
    });

    return image.webPath;
  } catch (error) {
    console.error('Error taking picture:', error);
    return null;
  }
}

export async function pickImage() {
  if (!Capacitor.isNativePlatform()) {
    console.log('Gallery only available on native platforms');
    return null;
  }

  try {
    const image = await Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
    });

    return image.webPath;
  } catch (error) {
    console.error('Error picking image:', error);
    return null;
  }
}
