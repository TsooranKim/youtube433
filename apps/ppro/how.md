`Project.importFiles`를 통해서 파일을 프로젝트로 불러오기

`Sequence.importMGT`를 통해서 `.mogrt` 파일을 불러오기

`Project.newSequence`를 통해서 sequence preset을 불러오기

`Project.getInsertionBin`을 통해서 import할 파일 폴더 지정

`Sequence.insertClip()`을 통해서 seqeunce에 `ProjectItem`을 넣기

`TrackItem.end`를 새로운 `Time` instance로 대체함으로 변경할 수 있다.
특정 instance에 할당된 Time instance는 immutable 해진다.
새로 할당하면 deep copy된 새로운 instance가 할당된다.
