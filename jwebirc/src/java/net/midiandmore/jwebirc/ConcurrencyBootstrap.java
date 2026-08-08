package net.midiandmore.jwebirc;

import jakarta.enterprise.concurrent.ManagedExecutorService;
import jakarta.enterprise.concurrent.ManagedScheduledExecutorService;
import jakarta.servlet.ServletContext;
import jakarta.servlet.ServletContextEvent;
import jakarta.servlet.ServletContextListener;
import javax.naming.InitialContext;
import javax.naming.NamingException;
import org.glassfish.enterprise.concurrent.AbstractManagedExecutorService.RejectPolicy;
import org.glassfish.enterprise.concurrent.ContextServiceImpl;
import org.glassfish.enterprise.concurrent.ManagedExecutorServiceImpl;
import org.glassfish.enterprise.concurrent.ManagedScheduledExecutorServiceImpl;
import org.glassfish.enterprise.concurrent.ManagedThreadFactoryImpl;
import org.glassfish.enterprise.concurrent.spi.ContextHandle;
import org.glassfish.enterprise.concurrent.spi.ContextSetupProvider;

/**
 * Registers the Jakarta Concurrency managed executors in JNDI.
 *
 * <p>Plain servlet containers such as Apache Tomcat do not provide the default managed
 * executors ({@code java:comp/DefaultManagedExecutorService} and
 * {@code java:comp/DefaultManagedScheduledExecutorService}). This listener builds the bundled
 * standalone Jakarta Concurrency implementation and binds the instances into the
 * {@code java:comp} namespace on startup, and unbinds them on shutdown.</p>
 */
public class ConcurrencyBootstrap implements ServletContextListener {

    private static final String EXECUTOR_JNDI = "java:comp/DefaultManagedExecutorService";
    private static final String SCHEDULED_JNDI = "java:comp/DefaultManagedScheduledExecutorService";

    private ManagedThreadFactoryImpl threadFactory;
    private ContextServiceImpl contextService;
    private ManagedExecutorServiceImpl executor;
    private ManagedScheduledExecutorServiceImpl scheduledExecutor;

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        try {
            ContextSetupProvider noOpProvider = new NoOpContextSetupProvider();
            contextService = new ContextServiceImpl("jwebirc-context", noOpProvider);
            threadFactory = new ManagedThreadFactoryImpl("jwebirc-thread-factory", contextService, 5);

            executor = new ManagedExecutorServiceImpl(
                    "jwebirc-managed-executor",
                    threadFactory,
                    0L,        // hung task threshold (ms); 0 = disabled
                    false,     // long-running tasks
                    5,         // core pool size
                    50,        // max pool size
                    60L,       // keep-alive
                    java.util.concurrent.TimeUnit.SECONDS,
                    0L,        // thread lifetime (ms); 0 = infinite
                    contextService,
                    RejectPolicy.ABORT,
                    new java.util.concurrent.LinkedBlockingQueue<>());

            scheduledExecutor = new ManagedScheduledExecutorServiceImpl(
                    "jwebirc-managed-scheduled-executor",
                    threadFactory,
                    0L,        // hung task threshold (ms); 0 = disabled
                    false,     // long-running tasks
                    1,         // core pool size
                    10L,       // keep-alive
                    java.util.concurrent.TimeUnit.SECONDS,
                    0L,        // thread lifetime (ms); 0 = infinite
                    contextService,
                    RejectPolicy.ABORT);

            InitialContext ictx = new InitialContext();
            try {
                bind(ictx, EXECUTOR_JNDI, executor);
                bind(ictx, SCHEDULED_JNDI, scheduledExecutor);
            } catch (NamingException ex) {
                sce.getServletContext().log("Could not bind managed executors in JNDI; "
                        + "using the application registry instead.", ex);
            }

            ConcurrencyResources.register(executor, scheduledExecutor);

            ServletContext ctx = sce.getServletContext();
            ctx.log("Jakarta Concurrency managed executors registered.");
        } catch (NamingException ex) {
            throw new IllegalStateException("Failed to register Jakarta Concurrency managed executors", ex);
        }
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        InitialContext ictx = null;
        try {
            ictx = new InitialContext();
            unbind(ictx, EXECUTOR_JNDI);
            unbind(ictx, SCHEDULED_JNDI);
        } catch (NamingException ex) {
            sce.getServletContext().log("Error unbinding Jakarta Concurrency managed executors", ex);
        } finally {
            ConcurrencyResources.unregister();
            safeShutdown(scheduledExecutor);
            safeShutdown(executor);
            if (threadFactory != null) {
                try {
                    threadFactory.stop();
                } catch (Exception ex) {
                    sce.getServletContext().log("Error stopping managed thread factory", ex);
                }
            }
        }
    }

    private static void bind(InitialContext ictx, String name, Object value) throws NamingException {
        int slash = name.lastIndexOf('/');
        if (slash > 0) {
            String parent = name.substring(0, slash);
            try {
                ictx.createSubcontext(parent);
            } catch (NamingException ex) {
                // Subcontext may already exist; ignore.
            }
        }
        ictx.rebind(name, value);
    }

    private static void unbind(InitialContext ictx, String name) throws NamingException {
        try {
            ictx.unbind(name);
        } catch (NamingException ex) {
            // Already unbound or never bound; ignore.
        }
    }

    private static void safeShutdown(java.util.concurrent.ExecutorService service) {
        if (service == null) {
            return;
        }
        service.shutdownNow();
    }

    /**
     * Minimal context setup provider that does not propagate any container context.
     *
     * <p>jWebIRC runs blocking I/O loops on these threads and does not rely on propagated
     * security/JNDI context, so a no-op provider is sufficient and keeps the implementation
     * container-independent.</p>
     */
    private static final class NoOpContextSetupProvider implements ContextSetupProvider {

        private static final long serialVersionUID = 1L;

        @Override
        public ContextHandle saveContext(jakarta.enterprise.concurrent.ContextService contextService) {
            return NoOpContextHandle.INSTANCE;
        }

        @Override
        public ContextHandle saveContext(jakarta.enterprise.concurrent.ContextService contextService,
                java.util.Map<String, String> executionProperties) {
            return NoOpContextHandle.INSTANCE;
        }

        @Override
        public ContextHandle setup(ContextHandle contextHandle) {
            return contextHandle;
        }

        @Override
        public void reset(ContextHandle contextHandle) {
            // Nothing to reset.
        }
    }

    private enum NoOpContextHandle implements ContextHandle {
        INSTANCE;

        private static final long serialVersionUID = 1L;
    }
}
