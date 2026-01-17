// Type declarations for Chrome Extension API

interface ChromeTab {
  id?: number;
  url?: string;
  active?: boolean;
  lastAccessed?: number;
}

interface ChromeTabs {
  query(queryInfo?: { active?: boolean; currentWindow?: boolean }): Promise<ChromeTab[]>;
  sendMessage(tabId: number, message: any): Promise<any>;
}

interface ChromeRuntime {
  onMessage: {
    addListener(callback: (message: any, sender: any, sendResponse: (response?: any) => void) => void | boolean): void;
    removeListener(callback: (message: any, sender: any, sendResponse: (response?: any) => void) => void | boolean): void;
  };
  sendMessage(message: any): Promise<any>;
  getURL(path: string): string;
}

interface ChromeStorage {
  local: {
    get(keys?: string | string[] | { [key: string]: any }): Promise<{ [key: string]: any }>;
    set(items: { [key: string]: any }): Promise<void>;
    remove(keys: string | string[]): Promise<void>;
  };
  onChanged: {
    addListener(callback: (changes: { [key: string]: { oldValue?: any; newValue?: any } }, areaName: string) => void): void;
    removeListener(callback: (changes: { [key: string]: { oldValue?: any; newValue?: any } }, areaName: string) => void): void;
  };
}

interface ChromeScripting {
  executeScript(options: {
    target: { tabId: number };
    func: (...args: any[]) => void;
    args?: any[];
  }): Promise<any[]>;
}

interface ChromeAPI {
  tabs: ChromeTabs;
  runtime: ChromeRuntime;
  scripting: ChromeScripting;
  storage: ChromeStorage;
}

declare const chrome: ChromeAPI;
