import {
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import manifest from '@/manifest';

import Root from './root';
import StoreContext from './contexts/StoreContext';
import MattermostContext from './contexts/MattermostContext';

class Plugin {
    async initialize(registry, store) {
        const override = (fileInfo) => {
            const supportedTypes = ['text/csv', 'text/csv; charset=utf-8', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
            return supportedTypes.includes(fileInfo.mime_type);
        };

        const FilePreviewComponent = (props) => (
            <StoreContext.Provider value={store}>
                <MattermostContext.Provider value={props}>
                    <QueryClientProvider client={new QueryClient()}>
                        <Root/>
                        <ReactQueryDevtools initialIsOpen={false}/>
                    </QueryClientProvider>
                </MattermostContext.Provider>
            </StoreContext.Provider>
        );

        registry.registerFilePreviewComponent(override, FilePreviewComponent);
    }
}

// window.registerPlugin = (pluginId, plugin) => {
//     window.registerPlugin(pluginId, plugin);
// };

window.registerPlugin(manifest.id, new Plugin());
