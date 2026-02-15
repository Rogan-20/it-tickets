// Service Worker for Push Notifications
self.addEventListener('push', function (event) {
    const data = event.data ? event.data.json() : {};
    const title = data.title || '🔧 IT Tickets';
    const options = {
        body: data.body || 'You have ticket updates',
        icon: '/ticket-icon.png',
        badge: '/ticket-icon.png',
        vibrate: [100, 50, 100],
        data: {
            url: data.url || '/'
        },
        actions: [
            { action: 'view', title: 'View Tickets' },
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };
    event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(url);
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        })
    );
});
