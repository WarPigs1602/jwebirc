package net.midiandmore.jwebirc;

import jakarta.enterprise.concurrent.ManagedExecutorService;
import jakarta.enterprise.concurrent.ManagedScheduledExecutorService;
import javax.naming.InitialContext;
import javax.naming.NamingException;

/**
 * Helpers for obtaining Jakarta Concurrency managed objects.
 *
 * <p>The managed executors are provided by {@link ConcurrencyBootstrap}, which builds the
 * bundled standalone Jakarta Concurrency implementation and registers the instances with this
 * registry on webapp startup. Plain servlet containers such as Apache Tomcat do not provide the
 * default managed executors via JNDI, so the registry is the portable source of the instances.
 * A JNDI fallback is kept for full Jakarta EE servers that do provide
 * {@code java:comp/DefaultManagedExecutorService}.</p>
 */
public final class ConcurrencyResources {

    private static volatile ManagedExecutorService executor;
    private static volatile ManagedScheduledExecutorService scheduledExecutor;

    private ConcurrencyResources() {
    }

    static void register(ManagedExecutorService managedExecutor,
            ManagedScheduledExecutorService managedScheduledExecutor) {
        executor = managedExecutor;
        scheduledExecutor = managedScheduledExecutor;
    }

    static void unregister() {
        executor = null;
        scheduledExecutor = null;
    }

    /**
     * Returns the managed executor used for running the IRC read loop.
     */
    public static ManagedExecutorService ircExecutor() {
        ManagedExecutorService current = executor;
        if (current != null) {
            return current;
        }
        return lookup(ManagedExecutorService.class, "java:comp/DefaultManagedExecutorService");
    }

    /**
     * Returns the managed scheduled executor used for the reconnect grace window.
     */
    public static ManagedScheduledExecutorService reconnectScheduler() {
        ManagedScheduledExecutorService current = scheduledExecutor;
        if (current != null) {
            return current;
        }
        return lookup(ManagedScheduledExecutorService.class,
                "java:comp/DefaultManagedScheduledExecutorService");
    }

    private static <T> T lookup(Class<T> type, String name) {
        try {
            return type.cast(InitialContext.doLookup(name));
        } catch (NamingException ex) {
            throw new IllegalStateException("Unable to locate managed executor " + name
                    + ". Ensure ConcurrencyBootstrap has registered the managed executors.", ex);
        }
    }
}
