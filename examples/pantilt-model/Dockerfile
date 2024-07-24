FROM openmodelica/openmodelica:v1.22.1-ompython
SHELL [ "/bin/bash", "-l", "-c" ]
EXPOSE 8765
EXPOSE 8766

# Install CMake
RUN apt-get update && apt-get -y install cmake protobuf-compiler

# Install Conda
RUN apt install wget -y

RUN useradd -m -s /bin/bash om
USER om
ENV USER om
ENV HOME /home/om
WORKDIR /home/om

RUN mkdir -p ~/miniconda3
RUN wget https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O ~/miniconda3/miniconda.sh
RUN bash ~/miniconda3/miniconda.sh -b -u -p ~/miniconda3
RUN rm -rf ~/miniconda3/miniconda.sh
RUN ~/miniconda3/bin/conda init bash
ENV PATH="~/miniconda3/bin:${PATH}"
RUN conda update conda -y

# Install PyFMI
COPY environment.yml environment.yml
RUN conda env create -f environment.yml
RUN conda init bash
RUN conda install -n omEnv websockets -y
RUN conda run -n omEnv pip install OMPython

# Copy .mo files and generate FMUs
COPY ./models ./models
COPY simulationBuilder.py simulationBuilder.py
RUN conda run -n omEnv python simulationBuilder.py

#Copy Python
COPY ./simulator.py ./simulator.py

CMD conda run --no-capture-output -n omEnv python simulator.py


