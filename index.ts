import './polyfills';

import { enableProdMode } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { AppModule } from './app.module';

import './locales/pt.po';

declare const __MODE__: string;
if (__MODE__ === 'production') {
  enableProdMode();
}

export async function bootstrap() {
  platformBrowserDynamic()
    .bootstrapModule(AppModule).catch((err) => console.log(err));
}
