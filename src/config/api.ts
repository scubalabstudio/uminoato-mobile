// うみのあとバックエンド（Laravel）。.env の EXPO_PUBLIC_BACKEND_URL で設定する
// ローカル開発時は .env.local に EXPO_PUBLIC_BACKEND_URL=http://192.168.x.x:8000 を書く
export const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? 'https://api.scubalab.net';
