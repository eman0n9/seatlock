package cz.fit.cvut.seatlock.config;

import cz.fit.cvut.seatlock.service.SeatGrpcService;
import io.grpc.Server;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.concurrent.TimeUnit;

@Slf4j
@Component
@RequiredArgsConstructor
public class GrpcServerRunner implements SmartLifecycle {

    private final SeatGrpcService seatGrpcService;

    @Value("${grpc.server.port:9090}")
    private int grpcPort;

    private Server server;
    private volatile boolean running = false;

    @Override
    public void start() {
        try {
            server = NettyServerBuilder.forPort(grpcPort)
                    .addService(seatGrpcService)
                    .build()
                    .start();
            running = true;
            log.info("gRPC Server started on port {}", grpcPort);
        } catch (IOException e) {
            throw new RuntimeException("Failed to start gRPC server on port " + grpcPort, e);
        }
    }

    @Override
    public void stop() {
        if (server != null) {
            log.info("Shutting down gRPC server...");
            server.shutdown();
            try {
                if (!server.awaitTermination(5, TimeUnit.SECONDS)) {
                    server.shutdownNow();
                }
            } catch (InterruptedException e) {
                server.shutdownNow();
                Thread.currentThread().interrupt();
            }
        }
        running = false;
    }

    @Override
    public boolean isRunning() {
        return running;
    }
}
